package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
)

func (s *AnalysisService) CreateJob(
	filename string,
	audioBytes []byte,
	scenario string,
	transcriptOverride *string,
	promptLanguage *string,
	uploadWandb bool,
) (models.AnalysisJob, error) {
	return s.CreateJobWithContext(
		context.Background(),
		filename,
		audioBytes,
		scenario,
		transcriptOverride,
		promptLanguage,
		uploadWandb,
	)
}

func (s *AnalysisService) CreateJobWithContext(
	ctx context.Context,
	filename string,
	audioBytes []byte,
	scenario string,
	transcriptOverride *string,
	promptLanguage *string,
	uploadWandb bool,
) (models.AnalysisJob, error) {
	analysisID := fmt.Sprintf("analysis_%d", time.Now().UTC().UnixNano())
	safeName := filepath.Base(filename)
	if safeName == "." || safeName == string(filepath.Separator) || safeName == "" {
		safeName = "upload.wav"
	}
	uploadDir := filepath.Join(s.uploadsRoot, analysisID)
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return models.AnalysisJob{}, err
	}
	audioPath := filepath.Join(uploadDir, safeName)
	if err := os.WriteFile(audioPath, audioBytes, 0o644); err != nil {
		return models.AnalysisJob{}, err
	}
	now := models.NowISO()
	job := models.AnalysisJob{
		AnalysisID:         analysisID,
		Status:             "queued",
		Scenario:           scenario,
		AudioFilename:      safeName,
		AudioPath:          audioPath,
		TranscriptOverride: transcriptOverride,
		PromptLanguage:     promptLanguage,
		UploadWandb:        uploadWandb,
		Warnings:           []string{},
		DominantCauses:     []string{},
		CompletedSteps:     0,
		TotalSteps:         4,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	saved, err := s.jobStore.Save(job)
	if err != nil {
		return models.AnalysisJob{}, err
	}
	s.logJobWithContext(ctx, saved).WithFields(logrus.Fields{
		"upload_wandb":        saved.UploadWandb,
		"has_transcript_hint": saved.TranscriptOverride != nil && strings.TrimSpace(*saved.TranscriptOverride) != "",
		"prompt_language":     optionalString(saved.PromptLanguage),
	}).Info("analysis job created")
	return saved, nil
}

func (s *AnalysisService) ListJobs(limit int) ([]models.AnalysisJob, error) {
	return s.jobStore.List(limit)
}

func (s *AnalysisService) GetJob(analysisID string) (*models.AnalysisJob, error) {
	return s.jobStore.Get(analysisID)
}

func (s *AnalysisService) StartJob(ctx context.Context, analysisID string) {
	go s.runJob(logging.DetachedContextWithMetadata(ctx), analysisID)
}

func (s *AnalysisService) runJob(ctx context.Context, analysisID string) {
	job, err := s.jobStore.Get(analysisID)
	if err != nil {
		s.loggerFromContext(ctx).WithError(err).WithField("analysis_id", analysisID).Error("load analysis job")
		return
	}
	if job == nil {
		s.loggerFromContext(ctx).WithField("analysis_id", analysisID).Warn("analysis job not found before execution")
		return
	}

	job.Status = "running"
	job.Error = nil
	job.CurrentNode = nil
	job.CompletedSteps = 0
	saved, saveErr := s.jobStore.Save(*job)
	if saveErr == nil {
		job = &saved
	}

	s.logJobWithContext(ctx, *job).WithFields(logrus.Fields{
		"total_steps": job.TotalSteps,
	}).Info("analysis job started")

	runningStatus := job.Status
	s.eventBroker.Publish(s.BuildEventWithContext(
		ctx,
		analysisID,
		"job_running",
		&runningStatus,
		nil,
		nil,
		intPtr(job.TotalSteps),
		nil,
		map[string]any{"job": s.SerializeJobWithContext(ctx, *job)},
		nil,
	))

	outputPath := filepath.Join(s.outputsRoot, fmt.Sprintf("%s.%s.json", job.AnalysisID, job.Scenario))
	finalEnvelope, runErr := s.runner.RunAnalysis(
		ctx,
		job.AnalysisID,
		job.AudioPath,
		job.Scenario,
		outputPath,
		job.TranscriptOverride,
		job.PromptLanguage,
		stringPtr(s.cfg.Backend.AgentConfigPath),
		func(event models.AnalysisEvent) error {
			if event.Node != nil {
				job.CurrentNode = event.Node
			}
			if event.EventType == "node_completed" && event.StepIndex != nil && *event.StepIndex > job.CompletedSteps {
				job.CompletedSteps = *event.StepIndex
			}
			if event.TotalSteps != nil {
				job.TotalSteps = *event.TotalSteps
			}
			savedJob, err := s.jobStore.Save(*job)
			if err == nil {
				job = &savedJob
			}
			payload := map[string]any{"job": s.SerializeJobWithContext(ctx, *job)}
			for key, value := range event.Payload {
				payload[key] = value
			}
			message := event.Message
			if substep, ok := payload["substep"].(string); ok && event.Node != nil && substep != "" {
				generated := fmt.Sprintf("%s `%s` in `%s`.", titleWords(strings.ReplaceAll(event.EventType, "_", " ")), substep, *event.Node)
				message = &generated
			}
			forwarded := s.BuildEventWithContext(
				ctx,
				analysisID,
				event.EventType,
				event.Status,
				event.Node,
				event.StepIndex,
				event.TotalSteps,
				event.Progress,
				payload,
				message,
			)
			s.eventBroker.Publish(forwarded)
			return nil
		},
	)

	if runErr != nil || finalEnvelope == nil {
		errMessage := "analysis execution failed"
		if runErr != nil {
			errMessage = runErr.Error()
		}
		job.Status = "failed"
		job.Error = &errMessage
		savedJob, _ := s.jobStore.Save(*job)
		s.logJobWithContext(ctx, savedJob).WithFields(logrus.Fields{
			"total_steps":     savedJob.TotalSteps,
			"completed_steps": savedJob.CompletedSteps,
			"result_path":     optionalString(savedJob.ResultPath),
			"dominant_causes": savedJob.DominantCauses,
			"warning_count":   len(savedJob.Warnings),
		}).WithError(runErr).Error("analysis job failed")
		s.eventBroker.Publish(s.BuildEventWithContext(
			ctx,
			analysisID,
			"analysis_failed",
			&savedJob.Status,
			nil,
			nil,
			intPtr(savedJob.TotalSteps),
			nil,
			map[string]any{"job": s.SerializeJobWithContext(ctx, savedJob), "error": errMessage},
			nil,
		))
		return
	}

	resultPath := finalEnvelope.ResultPath
	if resultPath != "" {
		job.ResultPath = &resultPath
	}
	if finalEnvelope.Error != nil {
		job.Error = finalEnvelope.Error
		job.Status = "failed"
	} else {
		job.Status = "completed"
	}
	finalNode := "finalize"
	job.CurrentNode = &finalNode
	job.CompletedSteps = job.TotalSteps
	applyStateSummary(job, finalEnvelope.State)
	savedJob, _ := s.jobStore.Save(*job)

	eventType := "analysis_completed"
	logEntry := s.logJobWithContext(ctx, savedJob).WithFields(logrus.Fields{
		"total_steps":     savedJob.TotalSteps,
		"completed_steps": savedJob.CompletedSteps,
		"result_path":     resultPath,
		"warning_count":   len(savedJob.Warnings),
		"dominant_causes": savedJob.DominantCauses,
		"overall_score":   optionalFloat(savedJob.OverallScore),
		"risk_score":      optionalFloat(savedJob.RiskScore),
		"level":           optionalString(savedJob.Level),
	})
	if savedJob.Error != nil {
		eventType = "analysis_failed"
		logEntry.WithField("error_text", *savedJob.Error).Error("analysis job finished with failure")
	} else {
		logEntry.Info("analysis job completed")
	}
	s.eventBroker.Publish(s.BuildEventWithContext(
		ctx,
		analysisID,
		eventType,
		&savedJob.Status,
		savedJob.CurrentNode,
		intPtr(savedJob.CompletedSteps),
		intPtr(savedJob.TotalSteps),
		nil,
		map[string]any{
			"job":         s.SerializeJobWithContext(ctx, savedJob),
			"result":      finalEnvelope.State,
			"result_path": resultPath,
		},
		nil,
	))
}

func applyStateSummary(job *models.AnalysisJob, state map[string]any) {
	warnings, _ := state["warnings"].([]any)
	job.Warnings = make([]string, 0, len(warnings))
	for _, item := range warnings {
		if text, ok := item.(string); ok {
			job.Warnings = append(job.Warnings, text)
		}
	}

	result, _ := state["result"].(map[string]any)
	if result == nil {
		return
	}
	if value, ok := result["overall_score"].(float64); ok {
		job.OverallScore = &value
	}
	if value, ok := result["risk_score"].(float64); ok {
		job.RiskScore = &value
	}
	if value, ok := result["level"].(string); ok && value != "" {
		job.Level = &value
	}
	if value, ok := result["summary"].(string); ok && value != "" {
		job.Summary = &value
	}
	causes, _ := result["dominant_causes"].([]any)
	job.DominantCauses = job.DominantCauses[:0]
	for _, item := range causes {
		if text, ok := item.(string); ok {
			job.DominantCauses = append(job.DominantCauses, text)
		}
	}
}

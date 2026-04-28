package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/agent"
	"speaksure/backend/internal/config"
	"speaksure/backend/internal/events"
	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
	"speaksure/backend/internal/store"
)

type AnalysisService struct {
	cfg         config.Config
	jobStore    *store.JobStore
	eventBroker *events.Broker
	runner      *agent.Runner
	logger      logrus.FieldLogger
	uploadsRoot string
	outputsRoot string
}

func NewAnalysisService(cfg config.Config, jobStore *store.JobStore, eventBroker *events.Broker, runner *agent.Runner, logger logrus.FieldLogger) (*AnalysisService, error) {
	uploadsRoot := cfg.Backend.UploadsRoot
	outputsRoot := cfg.Backend.ResultsRoot
	if err := os.MkdirAll(uploadsRoot, 0o755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(outputsRoot, 0o755); err != nil {
		return nil, err
	}
	return &AnalysisService{
		cfg:         cfg,
		jobStore:    jobStore,
		eventBroker: eventBroker,
		runner:      runner,
		logger:      logger,
		uploadsRoot: uploadsRoot,
		outputsRoot: outputsRoot,
	}, nil
}

func (s *AnalysisService) SerializeJob(job models.AnalysisJob) map[string]any {
	return s.SerializeJobWithContext(context.Background(), job)
}

func (s *AnalysisService) SerializeJobWithContext(ctx context.Context, job models.AnalysisJob) map[string]any {
	data := map[string]any{}
	raw, _ := json.Marshal(job)
	_ = json.Unmarshal(raw, &data)
	data["status_url"] = fmt.Sprintf("/api/v1/analyses/%s", job.AnalysisID)
	data["result_url"] = fmt.Sprintf("/api/v1/analyses/%s/result", job.AnalysisID)
	data["events_url"] = fmt.Sprintf("/api/v1/analyses/%s/events", job.AnalysisID)
	for key, value := range logging.FieldsFromContext(ctx) {
		data[key] = value
	}
	return data
}

func (s *AnalysisService) logJobWithContext(ctx context.Context, job models.AnalysisJob) *logrus.Entry {
	return s.logger.WithFields(logrus.Fields{
		"kind":         "analysis_job",
		"analysis_id":  job.AnalysisID,
		"scenario":     job.Scenario,
		"status":       job.Status,
		"audio_file":   job.AudioFilename,
		"audio_path":   job.AudioPath,
		"current_node": optionalString(job.CurrentNode),
	}).WithFields(logging.FieldsFromContext(ctx))
}

func (s *AnalysisService) loggerFromContext(ctx context.Context) logrus.FieldLogger {
	return s.logger.WithFields(logging.FieldsFromContext(ctx))
}

func intPtr(value int) *int          { return &value }
func stringPtr(value string) *string { return &value }
func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func optionalFloat(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

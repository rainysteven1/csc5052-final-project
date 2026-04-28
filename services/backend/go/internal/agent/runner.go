package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strings"

	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/config"
	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
)

type ProgressHandler func(models.AnalysisEvent) error

type Runner struct {
	cfg    config.Config
	logger logrus.FieldLogger
}

func NewRunner(cfg config.Config, logger logrus.FieldLogger) *Runner {
	return &Runner{cfg: cfg, logger: logger}
}

func (r *Runner) RunAnalysis(
	ctx context.Context,
	analysisID string,
	audioPath string,
	scenario string,
	outputPath string,
	transcriptOverride *string,
	promptLanguage *string,
	configPath *string,
	onProgress ProgressHandler,
) (*models.BridgeResultEnvelope, error) {
	bridgePath := r.cfg.Backend.AgentBridgeScript
	args := []string{bridgePath, "analyze", "--audio", audioPath, "--scenario", scenario, "--output", outputPath}
	if transcriptOverride != nil && strings.TrimSpace(*transcriptOverride) != "" {
		args = append(args, "--transcript-override", *transcriptOverride)
	}
	if promptLanguage != nil && strings.TrimSpace(*promptLanguage) != "" {
		args = append(args, "--prompt-language", *promptLanguage)
	}
	if configPath != nil && strings.TrimSpace(*configPath) != "" {
		args = append(args, "--config", *configPath)
	}

	entry := r.logger.WithFields(logrus.Fields{
		"kind":        "analysis_bridge",
		"analysis_id": analysisID,
		"scenario":    scenario,
		"audio_path":  audioPath,
		"output_path": outputPath,
		"python_bin":  r.cfg.Backend.PythonBin,
		"bridge_path": bridgePath,
	}).WithFields(logging.FieldsFromContext(ctx))

	cmd := exec.CommandContext(ctx, r.cfg.Backend.PythonBin, args...)
	cmd.Dir = r.cfg.RepoRoot

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		entry.WithError(err).Error("open bridge stdout pipe")
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		entry.WithError(err).Error("open bridge stderr pipe")
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		entry.WithError(err).Error("start bridge process")
		return nil, err
	}
	entry.WithField("command", append([]string{r.cfg.Backend.PythonBin}, args...)).Info("bridge process started")

	var stderrBuilder strings.Builder
	go func() {
		_, _ = io.Copy(&stderrBuilder, stderr)
	}()

	scanner := bufio.NewScanner(stdout)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 2*1024*1024)

	var final *models.BridgeResultEnvelope
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var typeProbe struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal([]byte(line), &typeProbe); err != nil {
			entry.WithError(err).WithField("line", line).Error("decode bridge message type")
			return nil, fmt.Errorf("decode bridge type: %w", err)
		}

		switch typeProbe.Type {
		case "progress":
			var progress models.BridgeProgressEnvelope
			if err := json.Unmarshal([]byte(line), &progress); err != nil {
				entry.WithError(err).WithField("line", line).Error("decode bridge progress")
				return nil, fmt.Errorf("decode bridge progress: %w", err)
			}
			entry.WithFields(logrus.Fields{
				"event_type": progress.Event.EventType,
				"node":       optionalString(progress.Event.Node),
				"step_index": progress.Event.StepIndex,
				"total":      progress.Event.TotalSteps,
			}).Debug("bridge progress event")
			if onProgress != nil {
				if err := onProgress(progress.Event); err != nil {
					entry.WithError(err).Error("progress callback failed")
					return nil, err
				}
			}
		case "completed", "failed":
			var result models.BridgeResultEnvelope
			if err := json.Unmarshal([]byte(line), &result); err != nil {
				entry.WithError(err).WithField("line", line).Error("decode bridge result")
				return nil, fmt.Errorf("decode bridge result: %w", err)
			}
			final = &result
		default:
			entry.WithField("message_type", typeProbe.Type).Error("unknown bridge message type")
			return nil, fmt.Errorf("unknown bridge message type: %s", typeProbe.Type)
		}
	}
	if err := scanner.Err(); err != nil {
		entry.WithError(err).Error("scan bridge output")
		return nil, fmt.Errorf("scan bridge output: %w", err)
	}

	err = cmd.Wait()
	if final == nil {
		stderrText := strings.TrimSpace(stderrBuilder.String())
		if err != nil {
			entry.WithError(err).WithField("stderr", stderrText).Error("bridge failed without final payload")
			return nil, fmt.Errorf("bridge failed: %w; stderr=%s", err, stderrText)
		}
		entry.Error("bridge completed without final payload")
		return nil, fmt.Errorf("bridge completed without final payload")
	}
	if err != nil && final.Error == nil {
		stderrText := strings.TrimSpace(stderrBuilder.String())
		if stderrText != "" {
			final.Error = &stderrText
		}
	}

	if final.Error != nil {
		entry.WithFields(logrus.Fields{
			"result_path": final.ResultPath,
			"stderr":      strings.TrimSpace(stderrBuilder.String()),
			"error_text":  *final.Error,
		}).Error("bridge process finished with failure")
	} else {
		entry.WithField("result_path", final.ResultPath).Info("bridge process finished successfully")
	}
	return final, nil
}

func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"speaksure/backend/internal/models"
)

func (s *AnalysisService) LoadReplay(path string) (*models.ReplayLoadResponse, error) {
	return s.LoadReplayWithContext(context.TODO(), path)
}

func (s *AnalysisService) LoadReplayWithContext(ctx context.Context, path string) (*models.ReplayLoadResponse, error) {
	resolved := filepath.Clean(path)
	data, err := os.ReadFile(resolved)
	if err != nil {
		s.loggerFromContext(ctx).WithError(err).WithField("replay_path", resolved).Warn("load replay file")
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		s.loggerFromContext(ctx).WithError(err).WithField("replay_path", resolved).Warn("parse replay file")
		return nil, err
	}
	absolute, err := filepath.Abs(resolved)
	if err != nil {
		absolute = resolved
	}
	s.loggerFromContext(ctx).WithField("replay_path", absolute).Info("replay loaded")
	return &models.ReplayLoadResponse{Mode: "replay", Path: absolute, Result: result}, nil
}

func (s *AnalysisService) ReadResult(job models.AnalysisJob) (map[string]any, error) {
	return s.ReadResultWithContext(context.TODO(), job)
}

func (s *AnalysisService) ReadResultWithContext(ctx context.Context, job models.AnalysisJob) (map[string]any, error) {
	if job.ResultPath == nil || strings.TrimSpace(*job.ResultPath) == "" {
		err := fmt.Errorf("no result recorded for analysis %s", job.AnalysisID)
		s.logJobWithContext(ctx, job).WithError(err).Warn("analysis result path missing")
		return nil, err
	}
	data, err := os.ReadFile(*job.ResultPath)
	if err != nil {
		s.logJobWithContext(ctx, job).WithError(err).WithField("result_path", *job.ResultPath).Warn("read analysis result")
		return nil, err
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		s.logJobWithContext(ctx, job).WithError(err).WithField("result_path", *job.ResultPath).Warn("parse analysis result")
		return nil, err
	}
	s.logJobWithContext(ctx, job).WithField("result_path", *job.ResultPath).Info("analysis result loaded")
	return result, nil
}

package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
)

func TestLoadReplayWithContextReturnsAbsolutePathAndPayload(t *testing.T) {
	root := t.TempDir()
	replayPath := filepath.Join(root, "result.json")
	if err := os.WriteFile(replayPath, []byte(`{"status":"completed","score":0.91}`), 0o644); err != nil {
		t.Fatalf("write replay: %v", err)
	}

	svc := &AnalysisService{logger: logrus.New()}
	ctx := logging.WithRequestMetadata(context.Background(), "req-r", "trace-r")
	result, err := svc.LoadReplayWithContext(ctx, replayPath)
	if err != nil {
		t.Fatalf("LoadReplayWithContext() error = %v", err)
	}

	absolute, _ := filepath.Abs(replayPath)
	if result.Path != absolute {
		t.Fatalf("path = %q, want %q", result.Path, absolute)
	}
	if result.Mode != "replay" {
		t.Fatalf("mode = %q, want replay", result.Mode)
	}
	if result.Result["status"] != "completed" {
		t.Fatalf("result status = %#v", result.Result["status"])
	}
}

func TestReadResultWithContextReturnsParsedJSON(t *testing.T) {
	root := t.TempDir()
	resultPath := filepath.Join(root, "analysis.json")
	if err := os.WriteFile(resultPath, []byte(`{"result":{"summary":"done"},"warnings":["a"]}`), 0o644); err != nil {
		t.Fatalf("write result: %v", err)
	}

	svc := &AnalysisService{logger: logrus.New()}
	job := models.AnalysisJob{
		AnalysisID: "analysis-1",
		ResultPath: &resultPath,
	}

	payload, err := svc.ReadResultWithContext(context.Background(), job)
	if err != nil {
		t.Fatalf("ReadResultWithContext() error = %v", err)
	}
	if _, ok := payload["result"].(map[string]any); !ok {
		t.Fatalf("result payload = %#v, want nested map", payload["result"])
	}
}

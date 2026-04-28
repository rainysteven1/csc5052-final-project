package service

import (
	"context"
	"testing"

	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
)

func TestBuildEventWithContextInjectsMetadataAndProgress(t *testing.T) {
	svc := &AnalysisService{}
	ctx := logging.WithRequestMetadata(context.Background(), "req-42", "trace-99")
	node := "coaching"
	step := 3
	total := 4

	event := svc.BuildEventWithContext(
		ctx,
		"analysis-1",
		"node_completed",
		nil,
		&node,
		&step,
		&total,
		nil,
		map[string]any{"kind": "demo"},
		nil,
	)

	if event.RequestID != "req-42" || event.TraceID != "trace-99" {
		t.Fatalf("metadata = request:%q trace:%q", event.RequestID, event.TraceID)
	}
	if event.Progress == nil || *event.Progress != 0.75 {
		t.Fatalf("progress = %#v, want 0.75", event.Progress)
	}
	if event.Message == nil || *event.Message != "Completed node `coaching`." {
		t.Fatalf("message = %#v", event.Message)
	}
	if event.Payload["kind"] != "demo" {
		t.Fatalf("payload kind = %#v, want demo", event.Payload["kind"])
	}
	if event.Payload["request_id"] != "req-42" || event.Payload["trace_id"] != "trace-99" {
		t.Fatalf("payload metadata = %+v", event.Payload)
	}
}

func TestApplyStateSummaryPullsResultFields(t *testing.T) {
	job := &models.AnalysisJob{}
	state := map[string]any{
		"warnings": []any{"warn-1", "warn-2"},
		"result": map[string]any{
			"overall_score":   0.84,
			"level":           "good",
			"summary":         "clear and steady",
			"dominant_causes": []any{"prosody", "lexical"},
		},
	}

	applyStateSummary(job, state)

	if len(job.Warnings) != 2 || job.Warnings[0] != "warn-1" {
		t.Fatalf("warnings = %+v", job.Warnings)
	}
	if job.OverallScore == nil || *job.OverallScore != 0.84 {
		t.Fatalf("overall score = %#v", job.OverallScore)
	}
	if job.Level == nil || *job.Level != "good" {
		t.Fatalf("level = %#v", job.Level)
	}
	if job.Summary == nil || *job.Summary != "clear and steady" {
		t.Fatalf("summary = %#v", job.Summary)
	}
	if len(job.DominantCauses) != 2 || job.DominantCauses[1] != "lexical" {
		t.Fatalf("dominant causes = %+v", job.DominantCauses)
	}
}

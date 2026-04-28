package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/logging"
)

func TestWriteJSONInjectsRequestMetadata(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest("GET", "/api/v1/health", nil)
	ctx.Request = request.WithContext(logging.WithRequestMetadata(request.Context(), "req-123", "trace-456"))

	api := New(nil, logrus.New())
	api.writeJSON(ctx, 202, gin.H{"status": "ok"})

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}

	if body["status"] != "ok" {
		t.Fatalf("status = %#v, want ok", body["status"])
	}
	if body["request_id"] != "req-123" {
		t.Fatalf("request_id = %#v, want req-123", body["request_id"])
	}
	if body["trace_id"] != "trace-456" {
		t.Fatalf("trace_id = %#v, want trace-456", body["trace_id"])
	}
}

func TestWriteErrorReturnsCodeAndDetail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest("GET", "/api/v1/analyses/missing", nil)
	ctx.Request = request.WithContext(logging.WithRequestMetadata(request.Context(), "req-1", "trace-1"))

	api := New(nil, logrus.New())
	api.writeError(ctx, 404, codeAnalysisNotFound, "missing analysis", nil)

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}

	if body["code"] != codeAnalysisNotFound {
		t.Fatalf("code = %#v, want %q", body["code"], codeAnalysisNotFound)
	}
	if body["detail"] != "missing analysis" {
		t.Fatalf("detail = %#v, want missing analysis", body["detail"])
	}
	if body["request_id"] != "req-1" || body["trace_id"] != "trace-1" {
		t.Fatalf("metadata missing from error body: %+v", body)
	}
}

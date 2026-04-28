package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/logging"
)

func TestHealthReturnsServiceEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	ctx.Request = request.WithContext(logging.WithRequestMetadata(request.Context(), "req-health", "trace-health"))

	api := New(nil, logrus.New())
	api.health(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}

	if body["service"] != "speaksure-backend-go" {
		t.Fatalf("service = %#v, want speaksure-backend-go", body["service"])
	}
	if body["request_id"] != "req-health" || body["trace_id"] != "trace-health" {
		t.Fatalf("metadata = %+v", body)
	}
}

package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"speaksure/backend/internal/logging"
)

func TestRequestContextPassesThroughSuppliedIDs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestContext())
	router.GET("/ping", func(c *gin.Context) {
		requestID, traceID := logging.RequestMetadataFromGin(c)
		c.JSON(http.StatusOK, gin.H{
			"request_id": requestID,
			"trace_id":   traceID,
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(logging.RequestIDHeader, "req-pass")
	req.Header.Set(logging.TraceIDHeader, "trace-pass")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Header().Get(logging.RequestIDHeader) != "req-pass" {
		t.Fatalf("response request id header = %q", recorder.Header().Get(logging.RequestIDHeader))
	}
	if recorder.Header().Get(logging.TraceIDHeader) != "trace-pass" {
		t.Fatalf("response trace id header = %q", recorder.Header().Get(logging.TraceIDHeader))
	}

	var body map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["request_id"] != "req-pass" || body["trace_id"] != "trace-pass" {
		t.Fatalf("body metadata = %+v", body)
	}
}

func TestRequestContextGeneratesIDsWhenMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestContext())
	router.GET("/ping", func(c *gin.Context) {
		requestID, traceID := logging.RequestMetadataFromGin(c)
		c.JSON(http.StatusOK, gin.H{
			"request_id": requestID,
			"trace_id":   traceID,
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	var body map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if len(body["request_id"]) != 32 {
		t.Fatalf("generated request_id length = %d, want 32", len(body["request_id"]))
	}
	if len(body["trace_id"]) != 32 {
		t.Fatalf("generated trace_id length = %d, want 32", len(body["trace_id"]))
	}
}

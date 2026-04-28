package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/config"
	"speaksure/backend/internal/events"
	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
	"speaksure/backend/internal/service"
	"speaksure/backend/internal/store"
)

type apiTestDeps struct {
	api      *API
	jobStore *store.JobStore
}

func newTestAPI(t *testing.T) apiTestDeps {
	t.Helper()

	root := t.TempDir()
	jobStore, err := store.NewJobStore(filepath.Join(root, "jobs"))
	if err != nil {
		t.Fatalf("NewJobStore() error = %v", err)
	}

	svc, err := service.NewAnalysisService(
		config.Config{
			RepoRoot: root,
			Backend: config.BackendConfig{
				JobsRoot:    filepath.Join(root, "jobs"),
				UploadsRoot: filepath.Join(root, "uploads"),
				ResultsRoot: filepath.Join(root, "results"),
			},
		},
		jobStore,
		events.NewBroker(),
		nil,
		logrus.New(),
	)
	if err != nil {
		t.Fatalf("NewAnalysisService() error = %v", err)
	}

	return apiTestDeps{
		api:      New(svc, logrus.New()),
		jobStore: jobStore,
	}
}

func newJSONTestContext(method string, path string, body []byte) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	ctx.Request = request.WithContext(logging.WithRequestMetadata(request.Context(), "req-test", "trace-test"))
	return ctx, recorder
}

func newPlainTestContext(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(method, path, nil)
	ctx.Request = request.WithContext(logging.WithRequestMetadata(request.Context(), "req-test", "trace-test"))
	return ctx, recorder
}

func TestListAnalysesReturnsSerializedJobs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	deps := newTestAPI(t)

	job1 := models.AnalysisJob{
		AnalysisID: "analysis-1",
		Status:     "queued",
		Scenario:   "presentation",
		CreatedAt:  "2024-01-01T00:00:00Z",
	}
	job2 := models.AnalysisJob{
		AnalysisID: "analysis-2",
		Status:     "completed",
		Scenario:   "interview",
		CreatedAt:  "2024-01-02T00:00:00Z",
	}
	if _, err := deps.jobStore.Save(job1); err != nil {
		t.Fatalf("save job1: %v", err)
	}
	if _, err := deps.jobStore.Save(job2); err != nil {
		t.Fatalf("save job2: %v", err)
	}

	ctx, recorder := newPlainTestContext(http.MethodGet, "/api/v1/analyses?limit=1")
	ctx.Request.URL.RawQuery = "limit=1"
	deps.api.listAnalyses(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["count"].(float64) != 1 {
		t.Fatalf("count = %#v, want 1", body["count"])
	}
	items := body["items"].([]any)
	first := items[0].(map[string]any)
	if first["analysis_id"] != "analysis-2" {
		t.Fatalf("first analysis_id = %#v, want analysis-2", first["analysis_id"])
	}
	if first["status_url"] == "" || first["events_url"] == "" || first["result_url"] == "" {
		t.Fatalf("serialized urls missing: %+v", first)
	}
}

func TestGetAnalysisReturnsNotFoundCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	deps := newTestAPI(t)
	ctx, recorder := newPlainTestContext(http.MethodGet, "/api/v1/analyses/missing")
	ctx.Params = gin.Params{{Key: "analysis_id", Value: "missing"}}

	deps.api.getAnalysis(ctx)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", recorder.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["code"] != codeAnalysisNotFound {
		t.Fatalf("code = %#v, want %q", body["code"], codeAnalysisNotFound)
	}
}

func TestGetAnalysisResultReturnsCompletedPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	deps := newTestAPI(t)

	resultPath := filepath.Join(t.TempDir(), "result.json")
	if err := os.WriteFile(resultPath, []byte(`{"summary":"done"}`), 0o644); err != nil {
		t.Fatalf("write result: %v", err)
	}
	job := models.AnalysisJob{
		AnalysisID: "analysis-done",
		Status:     "completed",
		Scenario:   "presentation",
		CreatedAt:  "2024-01-03T00:00:00Z",
		ResultPath: &resultPath,
	}
	if _, err := deps.jobStore.Save(job); err != nil {
		t.Fatalf("save job: %v", err)
	}

	ctx, recorder := newPlainTestContext(http.MethodGet, "/api/v1/analyses/analysis-done/result")
	ctx.Params = gin.Params{{Key: "analysis_id", Value: "analysis-done"}}
	deps.api.getAnalysisResult(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["analysis_id"] != "analysis-done" {
		t.Fatalf("analysis_id = %#v", body["analysis_id"])
	}
	result := body["result"].(map[string]any)
	if result["summary"] != "done" {
		t.Fatalf("result summary = %#v", result["summary"])
	}
}

func TestGetAnalysisResultReturnsConflictWhenRunning(t *testing.T) {
	gin.SetMode(gin.TestMode)
	deps := newTestAPI(t)

	job := models.AnalysisJob{
		AnalysisID: "analysis-running",
		Status:     "running",
		Scenario:   "presentation",
		CreatedAt:  "2024-01-03T00:00:00Z",
	}
	if _, err := deps.jobStore.Save(job); err != nil {
		t.Fatalf("save job: %v", err)
	}

	ctx, recorder := newPlainTestContext(http.MethodGet, "/api/v1/analyses/analysis-running/result")
	ctx.Params = gin.Params{{Key: "analysis_id", Value: "analysis-running"}}
	deps.api.getAnalysisResult(ctx)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", recorder.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["code"] != codeAnalysisNotReady {
		t.Fatalf("code = %#v, want %q", body["code"], codeAnalysisNotReady)
	}
}

func TestLoadReplayReturnsReplayPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	deps := newTestAPI(t)

	replayPath := filepath.Join(t.TempDir(), "replay.json")
	if err := os.WriteFile(replayPath, []byte(`{"status":"completed"}`), 0o644); err != nil {
		t.Fatalf("write replay: %v", err)
	}

	ctx, recorder := newJSONTestContext(
		http.MethodPost,
		"/api/v1/replays/load",
		[]byte(`{"path":"`+replayPath+`"}`),
	)
	deps.api.loadReplay(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload["mode"] != "replay" {
		t.Fatalf("mode = %#v", payload["mode"])
	}
	if payload["request_id"] != "req-test" || payload["trace_id"] != "trace-test" {
		t.Fatalf("metadata = %+v", payload)
	}
}

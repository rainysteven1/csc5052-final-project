package store

import (
	"os"
	"path/filepath"
	"testing"

	"speaksure/backend/internal/models"
)

func TestJobStoreSaveGetAndList(t *testing.T) {
	root := t.TempDir()
	store, err := NewJobStore(root)
	if err != nil {
		t.Fatalf("NewJobStore() error = %v", err)
	}

	jobOld := models.AnalysisJob{
		AnalysisID: "analysis-old",
		Status:     "queued",
		CreatedAt:  "2024-01-01T00:00:00Z",
	}
	jobNew := models.AnalysisJob{
		AnalysisID: "analysis-new",
		Status:     "completed",
		CreatedAt:  "2024-01-02T00:00:00Z",
	}

	if _, err := store.Save(jobOld); err != nil {
		t.Fatalf("Save(old) error = %v", err)
	}
	if _, err := store.Save(jobNew); err != nil {
		t.Fatalf("Save(new) error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "ignore.txt"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write ignore file: %v", err)
	}

	got, err := store.Get("analysis-new")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got == nil || got.AnalysisID != "analysis-new" {
		t.Fatalf("Get() = %+v, want analysis-new", got)
	}

	missing, err := store.Get("missing")
	if err != nil {
		t.Fatalf("Get(missing) error = %v", err)
	}
	if missing != nil {
		t.Fatalf("Get(missing) = %+v, want nil", missing)
	}

	list, err := store.List(1)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(list) != 1 || list[0].AnalysisID != "analysis-new" {
		t.Fatalf("List(1) = %+v, want newest job only", list)
	}
}

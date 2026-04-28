package store

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "sort"
    "sync"

    "speaksure/backend/internal/models"
)

type JobStore struct {
    root string
    mu   sync.Mutex
}

func NewJobStore(root string) (*JobStore, error) {
    if err := os.MkdirAll(root, 0o755); err != nil {
        return nil, err
    }
    return &JobStore{root: root}, nil
}

func (s *JobStore) jobPath(analysisID string) string {
    return filepath.Join(s.root, analysisID+".json")
}

func (s *JobStore) Save(job models.AnalysisJob) (models.AnalysisJob, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    job.UpdatedAt = models.NowISO()
    data, err := json.MarshalIndent(job, "", "  ")
    if err != nil {
        return job, err
    }
    if err := os.WriteFile(s.jobPath(job.AnalysisID), data, 0o644); err != nil {
        return job, err
    }
    return job, nil
}

func (s *JobStore) Get(analysisID string) (*models.AnalysisJob, error) {
    path := s.jobPath(analysisID)
    data, err := os.ReadFile(path)
    if err != nil {
        if os.IsNotExist(err) {
            return nil, nil
        }
        return nil, err
    }
    var job models.AnalysisJob
    if err := json.Unmarshal(data, &job); err != nil {
        return nil, err
    }
    return &job, nil
}

func (s *JobStore) List(limit int) ([]models.AnalysisJob, error) {
    entries, err := os.ReadDir(s.root)
    if err != nil {
        return nil, err
    }
    jobs := make([]models.AnalysisJob, 0, len(entries))
    for _, entry := range entries {
        if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
            continue
        }
        data, err := os.ReadFile(filepath.Join(s.root, entry.Name()))
        if err != nil {
            return nil, err
        }
        var job models.AnalysisJob
        if err := json.Unmarshal(data, &job); err != nil {
            return nil, fmt.Errorf("unmarshal %s: %w", entry.Name(), err)
        }
        jobs = append(jobs, job)
    }
    sort.Slice(jobs, func(i, j int) bool {
        return jobs[i].CreatedAt > jobs[j].CreatedAt
    })
    if limit > 0 && len(jobs) > limit {
        jobs = jobs[:limit]
    }
    return jobs, nil
}

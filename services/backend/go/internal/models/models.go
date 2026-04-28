package models

import "time"

type AnalysisJob struct {
	AnalysisID         string   `json:"analysis_id"`
	Status             string   `json:"status"`
	Scenario           string   `json:"scenario"`
	AudioFilename      string   `json:"audio_filename"`
	AudioPath          string   `json:"audio_path"`
	TranscriptOverride *string  `json:"transcript_override,omitempty"`
	PromptLanguage     *string  `json:"prompt_language,omitempty"`
	UploadWandb        bool     `json:"upload_wandb"`
	ResultPath         *string  `json:"result_path,omitempty"`
	Error              *string  `json:"error,omitempty"`
	Warnings           []string `json:"warnings"`
	OverallScore       *float64 `json:"overall_score,omitempty"`
	RiskScore          *float64 `json:"risk_score,omitempty"`
	Level              *string  `json:"level,omitempty"`
	Summary            *string  `json:"summary,omitempty"`
	DominantCauses     []string `json:"dominant_causes"`
	CurrentNode        *string  `json:"current_node,omitempty"`
	CompletedSteps     int      `json:"completed_steps"`
	TotalSteps         int      `json:"total_steps"`
	CreatedAt          string   `json:"created_at"`
	UpdatedAt          string   `json:"updated_at"`
}

type AnalysisEvent struct {
	AnalysisID string         `json:"analysis_id"`
	EventType  string         `json:"event_type"`
	Status     *string        `json:"status,omitempty"`
	Node       *string        `json:"node,omitempty"`
	StepIndex  *int           `json:"step_index,omitempty"`
	TotalSteps *int           `json:"total_steps,omitempty"`
	Progress   *float64       `json:"progress,omitempty"`
	Message    *string        `json:"message,omitempty"`
	RequestID  string         `json:"request_id,omitempty"`
	TraceID    string         `json:"trace_id,omitempty"`
	Payload    map[string]any `json:"payload"`
	CreatedAt  string         `json:"created_at"`
}

type ReplayLoadRequest struct {
	Path string `json:"path"`
}

type ReplayLoadResponse struct {
	Mode      string         `json:"mode"`
	Path      string         `json:"path"`
	Result    map[string]any `json:"result"`
	RequestID string         `json:"request_id,omitempty"`
	TraceID   string         `json:"trace_id,omitempty"`
}

type AnalysisResultResponse struct {
	AnalysisID string         `json:"analysis_id"`
	Status     string         `json:"status"`
	Result     map[string]any `json:"result"`
	RequestID  string         `json:"request_id,omitempty"`
	TraceID    string         `json:"trace_id,omitempty"`
}

type BridgeProgressEnvelope struct {
	Type  string        `json:"type"`
	Event AnalysisEvent `json:"event"`
}

type BridgeResultEnvelope struct {
	Type       string         `json:"type"`
	ResultPath string         `json:"result_path"`
	State      map[string]any `json:"state"`
	Error      *string        `json:"error"`
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

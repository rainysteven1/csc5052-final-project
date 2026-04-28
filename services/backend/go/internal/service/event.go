package service

import (
	"context"
	"fmt"
	"strings"

	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/models"
)

func (s *AnalysisService) BuildEvent(
	analysisID string,
	eventType string,
	status *string,
	node *string,
	stepIndex *int,
	totalSteps *int,
	progress *float64,
	payload map[string]any,
	message *string,
) models.AnalysisEvent {
	return s.BuildEventWithContext(context.Background(), analysisID, eventType, status, node, stepIndex, totalSteps, progress, payload, message)
}

func (s *AnalysisService) BuildEventWithContext(
	ctx context.Context,
	analysisID string,
	eventType string,
	status *string,
	node *string,
	stepIndex *int,
	totalSteps *int,
	progress *float64,
	payload map[string]any,
	message *string,
) models.AnalysisEvent {
	resolvedProgress := progress
	if resolvedProgress == nil && stepIndex != nil && totalSteps != nil && *totalSteps > 0 {
		p := float64(*stepIndex) / float64(*totalSteps)
		if p < 0 {
			p = 0
		}
		if p > 1 {
			p = 1
		}
		resolvedProgress = &p
	}
	if message == nil {
		auto := autoEventMessage(eventType, node)
		message = &auto
	}

	requestID, traceID := logging.RequestMetadataFromContext(ctx)
	return models.AnalysisEvent{
		AnalysisID: analysisID,
		EventType:  eventType,
		Status:     status,
		Node:       node,
		StepIndex:  stepIndex,
		TotalSteps: totalSteps,
		Progress:   resolvedProgress,
		Message:    message,
		RequestID:  requestID,
		TraceID:    traceID,
		Payload:    enrichEventPayload(ctx, payload),
		CreatedAt:  models.NowISO(),
	}
}

func (s *AnalysisService) Subscribe(analysisID string) ([]models.AnalysisEvent, chan models.AnalysisEvent) {
	return s.eventBroker.Subscribe(analysisID)
}

func (s *AnalysisService) Publish(event models.AnalysisEvent) models.AnalysisEvent {
	return s.eventBroker.Publish(event)
}

func (s *AnalysisService) Unsubscribe(analysisID string, ch chan models.AnalysisEvent) {
	s.eventBroker.Unsubscribe(analysisID, ch)
}

func autoEventMessage(eventType string, node *string) string {
	if eventType == "job_created" {
		return "Analysis job created."
	}
	if eventType == "job_running" {
		return "Analysis job is now running."
	}
	if eventType == "analysis_completed" {
		return "Analysis completed."
	}
	if eventType == "analysis_failed" {
		return "Analysis failed."
	}
	if node != nil {
		if eventType == "node_started" {
			return fmt.Sprintf("Started node `%s`.", *node)
		}
		if eventType == "node_completed" {
			return fmt.Sprintf("Completed node `%s`.", *node)
		}
		if eventType == "node_failed" {
			return fmt.Sprintf("Node `%s` failed.", *node)
		}
		if eventType == "substep_started" || eventType == "substep_completed" {
			return fmt.Sprintf("%s in `%s`.", titleWords(strings.ReplaceAll(eventType, "_", " ")), *node)
		}
	}
	return titleWords(strings.ReplaceAll(eventType, "_", " ")) + "."
}

func titleWords(value string) string {
	parts := strings.Fields(value)
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func enrichEventPayload(ctx context.Context, payload map[string]any) map[string]any {
	enriched := map[string]any{}
	for key, value := range payload {
		enriched[key] = value
	}
	for key, value := range logging.FieldsFromContext(ctx) {
		enriched[key] = value
	}
	return enriched
}

package events

import (
	"testing"

	"speaksure/backend/internal/models"
)

func TestBrokerSubscribeReceivesHistoryAndLiveEvents(t *testing.T) {
	broker := NewBroker()
	first := models.AnalysisEvent{AnalysisID: "analysis-1", EventType: "job_created"}
	second := models.AnalysisEvent{AnalysisID: "analysis-1", EventType: "node_completed"}

	broker.Publish(first)

	history, ch := broker.Subscribe("analysis-1")
	if len(history) != 1 || history[0].EventType != "job_created" {
		t.Fatalf("history = %+v, want first event", history)
	}

	broker.Publish(second)

	select {
	case event := <-ch:
		if event.EventType != "node_completed" {
			t.Fatalf("live event type = %q, want node_completed", event.EventType)
		}
	default:
		t.Fatal("expected live event from subscription")
	}

	broker.Unsubscribe("analysis-1", ch)

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("channel should be closed after unsubscribe")
		}
	default:
		t.Fatal("expected closed channel after unsubscribe")
	}
}

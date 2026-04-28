package events

import (
	"sync"

	"speaksure/backend/internal/models"
)

type Broker struct {
	mu          sync.Mutex
	history     map[string][]models.AnalysisEvent
	subscribers map[string]map[chan models.AnalysisEvent]struct{}
}

func NewBroker() *Broker {
	return &Broker{
		history:     map[string][]models.AnalysisEvent{},
		subscribers: map[string]map[chan models.AnalysisEvent]struct{}{},
	}
}

func (b *Broker) Publish(event models.AnalysisEvent) models.AnalysisEvent {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.history[event.AnalysisID] = append(b.history[event.AnalysisID], event)
	for ch := range b.subscribers[event.AnalysisID] {
		select {
		case ch <- event:
		default:
		}
	}
	return event
}

func (b *Broker) Subscribe(analysisID string) ([]models.AnalysisEvent, chan models.AnalysisEvent) {
	ch := make(chan models.AnalysisEvent, 64)
	b.mu.Lock()
	defer b.mu.Unlock()
	history := append([]models.AnalysisEvent(nil), b.history[analysisID]...)
	if _, ok := b.subscribers[analysisID]; !ok {
		b.subscribers[analysisID] = map[chan models.AnalysisEvent]struct{}{}
	}
	b.subscribers[analysisID][ch] = struct{}{}
	return history, ch
}

func (b *Broker) Unsubscribe(analysisID string, ch chan models.AnalysisEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	subscribers := b.subscribers[analysisID]
	delete(subscribers, ch)
	if len(subscribers) == 0 {
		delete(b.subscribers, analysisID)
	}
	close(ch)
}

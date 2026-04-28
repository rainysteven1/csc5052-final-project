package httpapi

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/models"
)

func (api *API) streamAnalysisEvents(c *gin.Context) {
	analysisID := c.Param("analysis_id")
	job, err := api.svc.GetJob(analysisID)
	if err != nil {
		api.writeError(c, http.StatusInternalServerError, codeAnalysisLookupFailed, err.Error(), err)
		return
	}
	if job == nil {
		api.writeError(c, http.StatusNotFound, codeAnalysisNotFound, fmt.Sprintf("Analysis job not found: %s", analysisID), nil)
		return
	}

	history, subscriber := api.svc.Subscribe(analysisID)
	defer api.svc.Unsubscribe(analysisID, subscriber)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	api.requestLogger(c).WithField("analysis_id", analysisID).WithField("history_events", len(history)).Info("sse stream opened")

	for _, event := range history {
		writeSSE(c, event)
	}
	c.Writer.Flush()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	notify := c.Request.Context().Done()
	for {
		select {
		case <-notify:
			api.requestLogger(c).WithField("analysis_id", analysisID).Info("sse stream closed by client")
			return
		case event, ok := <-subscriber:
			if !ok {
				api.requestLogger(c).WithField("analysis_id", analysisID).Warn("sse subscriber channel closed")
				return
			}
			writeSSE(c, event)
			c.Writer.Flush()
			if event.EventType == "analysis_completed" || event.EventType == "analysis_failed" {
				api.requestLogger(c).WithFields(logrus.Fields{
					"analysis_id": analysisID,
					"event_type":  event.EventType,
				}).Info("sse stream closed after terminal event")
				return
			}
		case <-ticker.C:
			_, _ = c.Writer.Write([]byte(": keep-alive\n\n"))
			c.Writer.Flush()
		}
	}
}

func writeSSE(c *gin.Context, event models.AnalysisEvent) {
	c.SSEvent(event.EventType, event)
}

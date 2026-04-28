package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/logging"
)

func RequestLogger(logger logrus.FieldLogger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		path := c.Request.URL.Path
		rawQuery := c.Request.URL.RawQuery

		c.Next()

		if rawQuery != "" {
			path = path + "?" + rawQuery
		}

		requestID, traceID := logging.RequestMetadataFromGin(c)
		entry := logger.WithFields(logrus.Fields{
			"kind":       "http_request",
			"status":     c.Writer.Status(),
			"method":     c.Request.Method,
			"path":       path,
			"client_ip":  c.ClientIP(),
			"latency_ms": time.Since(startedAt).Milliseconds(),
			"request_id": requestID,
			"trace_id":   traceID,
		})

		if len(c.Errors) > 0 {
			entry.WithField("errors", c.Errors.String()).Error("request completed with errors")
			return
		}

		status := c.Writer.Status()
		switch {
		case status >= 500:
			entry.Error("request completed")
		case status >= 400:
			entry.Warn("request completed")
		default:
			entry.Info("request completed")
		}
	}
}

package middleware

import (
	"speaksure/backend/internal/logging"

	"github.com/gin-gonic/gin"
)

func RequestContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := logging.EnsureRequestID(c.GetHeader(logging.RequestIDHeader))
		traceID := logging.EnsureTraceID(c.GetHeader(logging.TraceIDHeader))

		ctx := logging.WithRequestMetadata(c.Request.Context(), requestID, traceID)
		c.Request = c.Request.WithContext(ctx)

		c.Writer.Header().Set(logging.RequestIDHeader, requestID)
		c.Writer.Header().Set(logging.TraceIDHeader, traceID)

		c.Next()
	}
}

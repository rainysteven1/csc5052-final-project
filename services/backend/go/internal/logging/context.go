package logging

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

type contextKey string

const (
	requestIDKey contextKey = "request_id"
	traceIDKey   contextKey = "trace_id"

	RequestIDHeader = "X-Request-Id"
	TraceIDHeader   = "X-Trace-Id"
)

func WithRequestMetadata(ctx context.Context, requestID string, traceID string) context.Context {
	ctx = context.WithValue(ctx, requestIDKey, strings.TrimSpace(requestID))
	ctx = context.WithValue(ctx, traceIDKey, strings.TrimSpace(traceID))
	return ctx
}

func DetachedContextWithMetadata(ctx context.Context) context.Context {
	requestID, traceID := RequestMetadataFromContext(ctx)
	return WithRequestMetadata(context.Background(), requestID, traceID)
}

func RequestMetadataFromContext(ctx context.Context) (string, string) {
	if ctx == nil {
		return "", ""
	}
	requestID, _ := ctx.Value(requestIDKey).(string)
	traceID, _ := ctx.Value(traceIDKey).(string)
	return requestID, traceID
}

func FieldsFromContext(ctx context.Context) logrus.Fields {
	requestID, traceID := RequestMetadataFromContext(ctx)
	fields := logrus.Fields{}
	if requestID != "" {
		fields["request_id"] = requestID
	}
	if traceID != "" {
		fields["trace_id"] = traceID
	}
	return fields
}

func RequestMetadataFromGin(c *gin.Context) (string, string) {
	if c == nil || c.Request == nil {
		return "", ""
	}
	return RequestMetadataFromContext(c.Request.Context())
}

func EnsureRequestID(raw string) string {
	value := strings.TrimSpace(raw)
	if value != "" {
		return value
	}
	return randomID()
}

func EnsureTraceID(raw string) string {
	value := strings.TrimSpace(raw)
	if value != "" {
		return value
	}
	return randomID()
}

func randomID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "fallback-id"
	}
	return hex.EncodeToString(buf)
}

package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/service"
)

type API struct {
	svc    *service.AnalysisService
	logger logrus.FieldLogger
}

func New(svc *service.AnalysisService, logger logrus.FieldLogger) *API {
	return &API{svc: svc, logger: logger}
}

func (api *API) Register(router *gin.Engine) {
	group := router.Group("/api/v1")
	group.GET("/health", api.health)
	group.GET("/analyses", api.listAnalyses)
	group.POST("/analyses", api.submitAnalysis)
	group.GET("/analyses/:analysis_id", api.getAnalysis)
	group.GET("/analyses/:analysis_id/result", api.getAnalysisResult)
	group.GET("/analyses/:analysis_id/events", api.streamAnalysisEvents)
	group.POST("/replays/load", api.loadReplay)
}

func (api *API) requestLogger(c *gin.Context) *logrus.Entry {
	requestID, traceID := logging.RequestMetadataFromGin(c)
	return api.logger.WithFields(logrus.Fields{
		"kind":       "http_api",
		"request_id": requestID,
		"trace_id":   traceID,
		"method":     c.Request.Method,
		"path":       c.FullPath(),
	})
}

func (api *API) writeError(c *gin.Context, statusCode int, code string, detail string, err error) {
	entry := api.requestLogger(c).WithFields(logrus.Fields{
		"status": statusCode,
		"code":   code,
	})
	if detail != "" {
		entry = entry.WithField("detail", detail)
	}
	if err != nil {
		entry = entry.WithError(err)
	}

	switch {
	case statusCode >= http.StatusInternalServerError:
		entry.Error("api request failed")
	case statusCode >= http.StatusBadRequest:
		entry.Warn("api request rejected")
	default:
		entry.Info("api request completed")
	}

	api.writeJSON(c, statusCode, gin.H{"detail": detail, "code": code})
}

func (api *API) writeJSON(c *gin.Context, statusCode int, payload any) {
	body := map[string]any{}
	raw, err := json.Marshal(payload)
	if err == nil {
		_ = json.Unmarshal(raw, &body)
	}
	if len(body) == 0 {
		if direct, ok := payload.(map[string]any); ok {
			for key, value := range direct {
				body[key] = value
			}
		}
	}
	requestID, traceID := logging.RequestMetadataFromGin(c)
	if requestID != "" {
		body["request_id"] = requestID
	}
	if traceID != "" {
		body["trace_id"] = traceID
	}
	c.JSON(statusCode, body)
}

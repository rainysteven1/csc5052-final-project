package main

import (
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"speaksure/backend/internal/agent"
	"speaksure/backend/internal/config"
	"speaksure/backend/internal/events"
	"speaksure/backend/internal/httpapi"
	"speaksure/backend/internal/logging"
	"speaksure/backend/internal/middleware"
	"speaksure/backend/internal/service"
	"speaksure/backend/internal/store"
)

func main() {
	logger := logging.New()

	cfg, err := config.Load()
	if err != nil {
		logger.WithError(err).Fatal("load backend config")
	}

	jobsRoot := cfg.Backend.JobsRoot
	if err := os.MkdirAll(jobsRoot, 0o755); err != nil {
		logger.WithError(err).WithField("jobs_root", jobsRoot).Fatal("create jobs root")
	}

	jobStore, err := store.NewJobStore(jobsRoot)
	if err != nil {
		logger.WithError(err).Fatal("init job store")
	}

	broker := events.NewBroker()
	runner := agent.NewRunner(cfg, logger.WithField("component", "agent_runner"))
	analysisService, err := service.NewAnalysisService(cfg, jobStore, broker, runner, logger.WithField("component", "analysis_service"))
	if err != nil {
		logger.WithError(err).Fatal("init analysis service")
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestContext())
	router.Use(middleware.RequestLogger(logger.WithField("component", "http")))
	router.Use(middleware.CORS())
	httpapi.New(analysisService, logger.WithField("component", "http_api")).Register(router)

	addr := normalizeBind(cfg.Backend.BindAddress)
	logger.WithFields(logrus.Fields{
		"addr":       addr,
		"jobs_root":  jobsRoot,
		"python_bin": cfg.Backend.PythonBin,
	}).Info("starting Gin backend")

	if err := router.Run(addr); err != nil {
		logger.WithError(err).Fatal("run gin server")
	}
}

func normalizeBind(bind string) string {
	bind = strings.TrimSpace(bind)
	if bind == "" {
		return "127.0.0.1:8000"
	}
	if strings.HasPrefix(bind, ":") {
		return "127.0.0.1" + bind
	}
	return bind
}

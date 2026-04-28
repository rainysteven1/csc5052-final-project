package httpapi

import (
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"speaksure/backend/internal/models"
)

func (api *API) listAnalyses(c *gin.Context) {
	limit := 20
	if raw := c.Query("limit"); raw != "" {
		var parsed int
		_, _ = fmt.Sscanf(raw, "%d", &parsed)
		if parsed >= 1 && parsed <= 100 {
			limit = parsed
		}
	}
	jobs, err := api.svc.ListJobs(limit)
	if err != nil {
		api.writeError(c, http.StatusInternalServerError, codeAnalysisListFailed, err.Error(), err)
		return
	}
	items := make([]map[string]any, 0, len(jobs))
	for _, job := range jobs {
		items = append(items, api.svc.SerializeJob(job))
	}
	api.writeJSON(c, http.StatusOK, gin.H{"items": items, "count": len(items)})
}

func (api *API) submitAnalysis(c *gin.Context) {
	file, err := c.FormFile("audio")
	if err != nil {
		api.writeError(c, http.StatusBadRequest, codeAudioUploadRequired, "audio upload is required", err)
		return
	}
	scenario := c.PostForm("scenario")
	if scenario == "" {
		scenario = "interview"
	}
	transcript := c.PostForm("transcript_override")
	uploadWandb := c.PostForm("upload_wandb") == "true"

	src, err := file.Open()
	if err != nil {
		api.writeError(c, http.StatusBadRequest, codeAudioOpenFailed, err.Error(), err)
		return
	}
	defer src.Close()
	data, err := io.ReadAll(src)
	if err != nil {
		api.writeError(c, http.StatusBadRequest, codeAudioReadFailed, err.Error(), err)
		return
	}

	var transcriptPtr *string
	if transcript != "" {
		transcriptPtr = &transcript
	}
	job, err := api.svc.CreateJobWithContext(c.Request.Context(), file.Filename, data, scenario, transcriptPtr, uploadWandb)
	if err != nil {
		api.writeError(c, http.StatusInternalServerError, codeAnalysisCreateFailed, err.Error(), err)
		return
	}
	status := job.Status
	total := job.TotalSteps
	api.svc.Publish(api.svc.BuildEventWithContext(
		c.Request.Context(),
		job.AnalysisID,
		"job_created",
		&status,
		nil,
		nil,
		&total,
		nil,
		map[string]any{"job": api.svc.SerializeJobWithContext(c.Request.Context(), job)},
		nil,
	))
	api.svc.StartJob(c.Request.Context(), job.AnalysisID)
	api.writeJSON(c, http.StatusAccepted, api.svc.SerializeJobWithContext(c.Request.Context(), job))
}

func (api *API) getAnalysis(c *gin.Context) {
	job, err := api.svc.GetJob(c.Param("analysis_id"))
	if err != nil {
		api.writeError(c, http.StatusInternalServerError, codeAnalysisLookupFailed, err.Error(), err)
		return
	}
	if job == nil {
		api.writeError(c, http.StatusNotFound, codeAnalysisNotFound, fmt.Sprintf("Analysis job not found: %s", c.Param("analysis_id")), nil)
		return
	}
	api.writeJSON(c, http.StatusOK, api.svc.SerializeJobWithContext(c.Request.Context(), *job))
}

func (api *API) getAnalysisResult(c *gin.Context) {
	job, err := api.svc.GetJob(c.Param("analysis_id"))
	if err != nil {
		api.writeError(c, http.StatusInternalServerError, codeAnalysisLookupFailed, err.Error(), err)
		return
	}
	if job == nil {
		api.writeError(c, http.StatusNotFound, codeAnalysisNotFound, fmt.Sprintf("Analysis job not found: %s", c.Param("analysis_id")), nil)
		return
	}
	if job.Status == "queued" || job.Status == "running" {
		api.writeError(c, http.StatusConflict, codeAnalysisNotReady, "Analysis job is not finished yet.", nil)
		return
	}
	result, err := api.svc.ReadResultWithContext(c.Request.Context(), *job)
	if err != nil {
		api.writeError(c, http.StatusNotFound, codeAnalysisResultMissing, err.Error(), err)
		return
	}
	api.writeJSON(c, http.StatusOK, models.AnalysisResultResponse{
		AnalysisID: job.AnalysisID,
		Status:     job.Status,
		Result:     result,
	})
}

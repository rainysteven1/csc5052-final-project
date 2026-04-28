package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"speaksure/backend/internal/models"
)

func (api *API) loadReplay(c *gin.Context) {
	var request models.ReplayLoadRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		api.writeError(c, http.StatusBadRequest, codeReplayRequestInvalid, err.Error(), err)
		return
	}
	result, err := api.svc.LoadReplayWithContext(c.Request.Context(), request.Path)
	if err != nil {
		api.writeError(c, http.StatusNotFound, codeReplayNotFound, err.Error(), err)
		return
	}
	api.writeJSON(c, http.StatusOK, result)
}

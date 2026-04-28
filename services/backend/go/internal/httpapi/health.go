package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (api *API) health(c *gin.Context) {
	api.writeJSON(c, http.StatusOK, gin.H{
		"status":  "ok",
		"service": "speaksure-backend-go",
		"message": "Gin backend is active.",
	})
}

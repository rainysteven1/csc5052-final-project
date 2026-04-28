package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	RepoRoot string        `mapstructure:"-"`
	Backend  BackendConfig `mapstructure:"backend"`
}

type BackendConfig struct {
	BindAddress       string `mapstructure:"bind"`
	PythonBin         string `mapstructure:"python_bin"`
	AgentBridgeScript string `mapstructure:"agent_bridge_script"`
	AgentConfigPath   string `mapstructure:"agent_config_path"`
	DataRoot          string `mapstructure:"data_root"`
	JobsRoot          string `mapstructure:"jobs_root"`
	UploadsRoot       string `mapstructure:"uploads_root"`
	ResultsRoot       string `mapstructure:"results_root"`
}

func repoRootFromFile() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		cwd, _ := os.Getwd()
		return cwd
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", ".."))
}

func defaultConfigPath(repoRoot string) string {
	return filepath.Join(repoRoot, "services", "backend", "config", "config.toml")
}

func Load() (Config, error) {
	repoRoot := getenvDefault("SPEAKSURE_REPO_ROOT", repoRootFromFile())
	cfgPath := getenvDefault("SPEAKSURE_BACKEND_CONFIG", defaultConfigPath(repoRoot))

	v := viper.New()
	v.SetConfigFile(cfgPath)
	v.SetConfigType("toml")
	v.SetEnvPrefix("SPEAKSURE")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	v.SetDefault("backend.bind", "127.0.0.1:8000")
	v.SetDefault("backend.python_bin", "python")
	v.SetDefault("backend.agent_bridge_script", "services/agent/backend_bridge.py")
	v.SetDefault("backend.agent_config_path", "services/agent/config/config.toml")
	v.SetDefault("backend.data_root", "services/agent/data")
	v.SetDefault("backend.jobs_root", "services/backend/data/jobs")
	v.SetDefault("backend.uploads_root", "services/backend/data/uploads")
	v.SetDefault("backend.results_root", "services/backend/data/results")

	_ = v.BindEnv("backend.bind", "SPEAKSURE_BACKEND_BIND")
	_ = v.BindEnv("backend.python_bin", "PYTHON_BIN", "SPEAKSURE_BACKEND_PYTHON_BIN")
	_ = v.BindEnv("backend.agent_bridge_script", "SPEAKSURE_BACKEND_AGENT_BRIDGE_SCRIPT")
	_ = v.BindEnv("backend.agent_config_path", "SPEAKSURE_BACKEND_AGENT_CONFIG_PATH")
	_ = v.BindEnv("backend.data_root", "SPEAKSURE_BACKEND_DATA_ROOT", "SPEAKSURE_AGENT_DATA_ROOT")
	_ = v.BindEnv("backend.jobs_root", "SPEAKSURE_BACKEND_JOBS_ROOT")
	_ = v.BindEnv("backend.uploads_root", "SPEAKSURE_BACKEND_UPLOADS_ROOT")
	_ = v.BindEnv("backend.results_root", "SPEAKSURE_BACKEND_RESULTS_ROOT")

	if err := v.ReadInConfig(); err != nil {
		return Config{}, fmt.Errorf("read backend config %s: %w", cfgPath, err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return Config{}, fmt.Errorf("decode backend config: %w", err)
	}
	cfg.RepoRoot = repoRoot
	cfg.Backend.AgentBridgeScript = cfg.ResolvePath(cfg.Backend.AgentBridgeScript)
	cfg.Backend.AgentConfigPath = cfg.ResolvePath(cfg.Backend.AgentConfigPath)
	cfg.Backend.DataRoot = cfg.ResolvePath(cfg.Backend.DataRoot)
	cfg.Backend.JobsRoot = cfg.ResolvePath(cfg.Backend.JobsRoot)
	cfg.Backend.UploadsRoot = cfg.ResolvePath(cfg.Backend.UploadsRoot)
	cfg.Backend.ResultsRoot = cfg.ResolvePath(cfg.Backend.ResultsRoot)
	return cfg, nil
}

func (c Config) ResolvePath(path string) string {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return trimmed
	}
	if filepath.IsAbs(trimmed) {
		return filepath.Clean(trimmed)
	}
	return filepath.Clean(filepath.Join(c.RepoRoot, trimmed))
}

func getenvDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

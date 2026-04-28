package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadResolvesPathsAndEnvOverrides(t *testing.T) {
	t.Setenv("SPEAKSURE_REPO_ROOT", t.TempDir())

	repoRoot := os.Getenv("SPEAKSURE_REPO_ROOT")
	configPath := filepath.Join(repoRoot, "backend.test.toml")
	if err := os.WriteFile(configPath, []byte(`
[backend]
bind = "0.0.0.0:9000"
python_bin = "python3"
agent_bridge_script = "scripts/bridge.py"
agent_config_path = "configs/agent.toml"
data_root = "data"
jobs_root = "jobs"
uploads_root = "uploads"
results_root = "results"
`), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	t.Setenv("SPEAKSURE_BACKEND_CONFIG", configPath)
	t.Setenv("SPEAKSURE_BACKEND_BIND", "127.0.0.1:9100")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.RepoRoot != repoRoot {
		t.Fatalf("RepoRoot = %q, want %q", cfg.RepoRoot, repoRoot)
	}
	if cfg.Backend.BindAddress != "127.0.0.1:9100" {
		t.Fatalf("BindAddress = %q, want env override", cfg.Backend.BindAddress)
	}
	if cfg.Backend.PythonBin != "python3" {
		t.Fatalf("PythonBin = %q, want python3", cfg.Backend.PythonBin)
	}

	checks := map[string]string{
		"AgentBridgeScript": cfg.Backend.AgentBridgeScript,
		"AgentConfigPath":   cfg.Backend.AgentConfigPath,
		"DataRoot":          cfg.Backend.DataRoot,
		"JobsRoot":          cfg.Backend.JobsRoot,
		"UploadsRoot":       cfg.Backend.UploadsRoot,
		"ResultsRoot":       cfg.Backend.ResultsRoot,
	}
	expected := map[string]string{
		"AgentBridgeScript": filepath.Join(repoRoot, "scripts", "bridge.py"),
		"AgentConfigPath":   filepath.Join(repoRoot, "configs", "agent.toml"),
		"DataRoot":          filepath.Join(repoRoot, "data"),
		"JobsRoot":          filepath.Join(repoRoot, "jobs"),
		"UploadsRoot":       filepath.Join(repoRoot, "uploads"),
		"ResultsRoot":       filepath.Join(repoRoot, "results"),
	}
	for name, got := range checks {
		if got != filepath.Clean(expected[name]) {
			t.Fatalf("%s = %q, want %q", name, got, filepath.Clean(expected[name]))
		}
	}
}

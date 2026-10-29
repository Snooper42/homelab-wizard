package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

// The docker package reads the engine's API unless DOCKER_API in .env is
// off, and each read that went back to the CLI is kept in
// scripts/logs/docker-api.json, for homelab doctor and the report.
func init() {
	docker.Settings = func() map[string]string {
		if r := Root(); r != "" {
			return Env(r)
		}
		return nil
	}
	docker.OnFallback = func(f docker.Fallback) {
		if r := Root(); r != "" {
			_ = SaveAPIFallback(r, f)
		}
	}
}

func apiFallbackPath(root string) string {
	return filepath.Join(root, "scripts", "logs", "docker-api.json")
}

// SaveAPIFallback keeps the last read that went back to the CLI.
func SaveAPIFallback(root string, f docker.Fallback) error {
	path := apiFallbackPath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(f, "", "  ")
	return os.WriteFile(path, data, 0o644)
}

// APIFallback is the last read that went back to the CLI in the past week,
// if any.
func APIFallback(root string, now time.Time) (docker.Fallback, bool) {
	var f docker.Fallback
	data, err := os.ReadFile(apiFallbackPath(root))
	if err != nil || json.Unmarshal(data, &f) != nil || f.When.IsZero() || now.Sub(f.When) > 7*24*time.Hour {
		return docker.Fallback{}, false
	}
	return f, true
}

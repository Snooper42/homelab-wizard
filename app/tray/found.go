package tray

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// Found is what the app's last look for updates found (the homelab files
// and its own build, as one update), kept for the menu bar item, which
// runs apart from the window. With the window closed the item looks
// itself, at most as often.
type Found struct {
	Looked  time.Time `json:"looked"`
	Ready   bool      `json:"ready"`
	Version string    `json:"version,omitempty"` // "0.15.0", when known
}

// FoundPath is where Found is kept, beside appearance.json.
func FoundPath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "found.json")
}

// LoadFound reads the last look; zero when there was none.
func LoadFound() Found {
	var f Found
	if data, err := os.ReadFile(FoundPath()); err == nil {
		_ = json.Unmarshal(data, &f)
	}
	return f
}

// SaveFound keeps f for the next reading.
func SaveFound(f Found) error {
	path := FoundPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(f, "", "  ")
	return os.WriteFile(path, data, 0o644)
}

// UpdateItem is the menu's update line: "Update to 0.15.0", or "" when
// nothing waits.
func UpdateItem(f Found) string {
	switch {
	case !f.Ready:
		return ""
	case f.Version != "":
		return "Update to " + f.Version
	}
	return "Update Homelab Wizard"
}

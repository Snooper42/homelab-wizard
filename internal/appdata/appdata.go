// Package appdata says where the apps' data lives: APPDATA_ROOT in .env,
// else data/appdata in the homelab folder (quality-loop D3). Every compose
// file mounts it as ${APPDATA_ROOT:-./data/appdata}, and the CLI reads it
// here, so the two never disagree.
package appdata

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// Key is the .env setting.
const Key = "APPDATA_ROOT"

// Default is where the apps' data lives when APPDATA_ROOT is unset, in the homelab folder.
const Default = "data/appdata"

// Dir is the apps' data folder for the homelab at root, as Compose resolves it: APPDATA_ROOT as written (~ for the
// home folder; a relative one against the homelab folder, as Compose's project directory), else data/appdata.
func Dir(root string) string {
	v := ""
	if env, err := envfile.Load(filepath.Join(root, ".env")); err == nil {
		v = env.Map()[Key]
	}
	return Resolve(root, v)
}

// Resolve is Dir for a value already read.
func Resolve(root, v string) string {
	v = strings.TrimSpace(v)
	switch {
	case v == "":
		return filepath.Join(root, Default)
	case strings.HasPrefix(v, "~/"):
		home, _ := os.UserHomeDir()
		return filepath.Join(home, v[2:])
	case filepath.IsAbs(v):
		return filepath.Clean(v)
	}
	return filepath.Join(root, v)
}

// Path is a file or folder under the apps' data folder (an app's own: Path(root, "homepage", "services.yaml")).
func Path(root string, parts ...string) string {
	return filepath.Join(append([]string{Dir(root)}, parts...)...)
}

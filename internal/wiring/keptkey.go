package wiring

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// KeptKey is the API key an app keeps itself, read from file in its config
// folder dir (the catalog's keyfile): an *arr app's config.xml, Seerr's
// settings.json, Bazarr's config.yaml. Sign-in details copies it from
// there, so it never has to be found in the app's settings.
func KeptKey(dir, file string) (string, error) {
	if dir == "" {
		return "", errors.New("its settings folder isn't known (is it installed?)")
	}
	clean := path.Clean(filepath.ToSlash(file))
	if file == "" || path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("%q is not a file in its settings folder", file)
	}
	p := filepath.Join(dir, filepath.FromSlash(clean))
	data, err := os.ReadFile(p)
	if err != nil {
		return "", errors.New("it hasn't made its API key yet: open it once, then try again")
	}
	var key string
	switch strings.ToLower(path.Ext(clean)) {
	case ".xml":
		if m := apiKeyRe.FindSubmatch(data); m != nil {
			key = string(m[1])
		}
	case ".json":
		var s struct {
			Main struct {
				APIKey string `json:"apiKey"`
			} `json:"main"`
		}
		if json.Unmarshal(data, &s) == nil {
			key = s.Main.APIKey
		}
	case ".yaml", ".yml":
		var c struct {
			Auth struct {
				APIKey string `yaml:"apikey"`
			} `yaml:"auth"`
		}
		if yaml.Unmarshal(data, &c) == nil {
			key = c.Auth.APIKey
		}
	}
	if strings.TrimSpace(key) == "" {
		return "", errors.New("it hasn't made its API key yet: open it once, then try again")
	}
	return strings.TrimSpace(key), nil
}

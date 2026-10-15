// Package settings lists and edits the homelab's .env for the app's
// Settings screen. .env.example is the schema: its "# --- Section ---"
// headers group the keys, the comments above a key explain it, and secrets
// (generated placeholders, tokens, passwords) are never read back out.
package settings

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/envfile"
)

// Setting is one .env key.
type Setting struct {
	Key     string `json:"key"`
	Section string `json:"section"`
	Help    string `json:"help,omitempty"`
	Secret  bool   `json:"secret"`
	Set     bool   `json:"set"`             // has a value
	Value   string `json:"value,omitempty"` // only for settings that are not secret
}

var (
	sectionRe = regexp.MustCompile(`^#\s*-+\s*(.+?)\s*-+\s*$`)
	keyRe     = regexp.MustCompile(`^([A-Za-z_][A-Za-z0-9_]*)=(.*)$`)
	secretRe  = regexp.MustCompile(`(TOKEN|PASSWORD|PASSPHRASE|SECRET|_KEY|_AUTH)$|AUTHKEY$|PRIVATE_KEY|HEARTBEAT_URL`)
)

// IsSecret reports whether a key's value must never be shown back.
func IsSecret(key, exampleValue string) bool {
	return secretRe.MatchString(key) || envfile.Placeholder.MatchString(exampleValue)
}

// List returns every key in .env.example, in its order, with the values
// from .env (secrets only say whether they are set).
func List(root string) ([]Setting, error) {
	f, err := os.Open(filepath.Join(root, ".env.example"))
	if err != nil {
		return nil, err
	}
	defer f.Close()
	env := map[string]string{}
	if e, err := envfile.Load(filepath.Join(root, ".env")); err == nil {
		env = e.Map()
	}
	var out []Setting
	section, help := "General", []string{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		switch m := keyRe.FindStringSubmatch(line); {
		case line == "":
			help = help[:0]
		case sectionRe.MatchString(line):
			section, help = sectionRe.FindStringSubmatch(line)[1], help[:0]
		case strings.HasPrefix(line, "#"):
			help = append(help, strings.TrimSpace(strings.TrimPrefix(line, "#")))
		case m != nil:
			s := Setting{Key: m[1], Section: section, Help: strings.Join(help, " "), Secret: IsSecret(m[1], m[2])}
			v := env[m[1]]
			s.Set = strings.TrimSpace(v) != "" && !envfile.Placeholder.MatchString(v)
			if !s.Secret {
				s.Value = v
			}
			out = append(out, s)
			help = help[:0]
		}
	}
	return out, sc.Err()
}

// Save writes values into .env. Only keys .env.example knows are accepted;
// the error names the key, never the value.
func Save(root string, values map[string]string) error {
	known, err := List(root)
	if err != nil {
		return err
	}
	ok, secret := map[string]bool{}, map[string]bool{}
	for _, s := range known {
		ok[s.Key], secret[s.Key] = true, s.Secret
	}
	for k, v := range values {
		if !ok[k] {
			return fmt.Errorf("%s is not a homelab setting", k)
		}
		if strings.ContainsAny(v, "\n\r") {
			return fmt.Errorf("%s cannot span lines", k)
		}
	}
	env, err := envfile.Load(filepath.Join(root, ".env"))
	if err != nil {
		return err
	}
	if !env.Exists() {
		return fmt.Errorf(".env does not exist yet; start the homelab first")
	}
	for k, v := range values {
		// A secret is never shown, so an empty field means "keep it".
		if secret[k] && strings.TrimSpace(v) == "" {
			continue
		}
		env.Set(k, v)
	}
	return env.Save()
}

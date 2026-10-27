package tray

import (
	"encoding/json"
	"image/color"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
)

// Appearance is how the app looks on this machine, picked in Settings ›
// Appearance. It is kept beside the window's place, not in .env: it belongs
// to the person at this computer, not to the homelab. The menu bar item
// reads Icon from it.
type Appearance struct {
	Theme    string `json:"theme"`    // "system", "light", or "dark"
	Accent   string `json:"accent"`   // "" for the system's, else #rrggbb
	Contrast string `json:"contrast"` // "system" or "more"
	Layout   string `json:"layout"`   // "classic", or "islands": the sidebar and the page as panels of their own
	Icon     string `json:"icon"`     // "" for the usual, "accent" for the accent, else #rrggbb
	// Motion is "system" (less when the system asks to reduce motion),
	// "less" (no movement; colours still fade), or "none" (nothing moves).
	Motion string `json:"motion"`
	// Transparency is "system" (none when the system asks to reduce it)
	// or "off" (no blur or see-through panels).
	Transparency string `json:"transparency"`
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Clean returns a with anything it does not know put back to the default.
func (a Appearance) Clean() Appearance {
	pick := func(v, def string, ok ...string) string {
		for _, o := range ok {
			if v == o {
				return v
			}
		}
		return def
	}
	a.Theme = pick(a.Theme, "system", "system", "light", "dark")
	a.Contrast = pick(a.Contrast, "system", "system", "more")
	a.Layout = pick(a.Layout, "classic", "classic", "islands")
	a.Motion = pick(a.Motion, "system", "system", "less", "none")
	a.Transparency = pick(a.Transparency, "system", "system", "off")
	if !hexColor.MatchString(a.Accent) {
		a.Accent = ""
	}
	if a.Icon != "accent" && !hexColor.MatchString(a.Icon) {
		a.Icon = ""
	}
	return a
}

// AppearancePath is where Appearance is kept.
func AppearancePath() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "Homelab Wizard", "appearance.json")
}

// LoadAppearance reads the appearance kept, or the defaults.
func LoadAppearance() Appearance {
	var a Appearance
	if data, err := os.ReadFile(AppearancePath()); err == nil {
		_ = json.Unmarshal(data, &a)
	}
	return a.Clean()
}

// SaveAppearance keeps a, cleaned, and returns what was kept.
func SaveAppearance(a Appearance) (Appearance, error) {
	a = a.Clean()
	path := AppearancePath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return a, err
	}
	data, _ := json.MarshalIndent(a, "", "  ")
	return a, os.WriteFile(path, append(data, '\n'), 0o644)
}

// IconInk is the colour the menu bar item's icon is drawn in, and false for
// the usual icon (a template on the Mac, which macOS colours itself).
func (a Appearance) IconInk() (color.NRGBA, bool) {
	c := a.Icon
	if c == "accent" {
		c = a.Accent // the system's accent is the usual icon
	}
	if !hexColor.MatchString(c) {
		return color.NRGBA{}, false
	}
	v, _ := strconv.ParseUint(c[1:], 16, 32)
	// #nosec G115 -- each is one byte of a 24-bit colour
	return color.NRGBA{R: uint8(v >> 16), G: uint8(v >> 8), B: uint8(v), A: 255}, true
}

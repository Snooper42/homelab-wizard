package main

import (
	"fmt"
	"strconv"
	"strings"
)

// Accent is the colour the person picked for their system (Windows'
// Settings › Personalization › Colors, the Mac's System Settings ›
// Appearance, GNOME's and KDE's own), in the shades the system itself
// uses for buttons and links on a light and on a dark background. The
// page uses it in place of its own blue (style.css, html.sys-accent).
type Accent struct {
	Light string `json:"light"` // "#0067c0"
	Dark  string `json:"dark"`  // "#4cc2ff"
	// Text is drawn on the accent when white would not read (macOS's
	// yellow); empty keeps the platform's own.
	Text string `json:"text,omitempty"`
}

// accentFromPalette reads Windows' AccentPalette: eight colours of four
// bytes (red, green, blue, unused), lightest first. Windows 11 draws
// accent buttons and links in Dark 1 (the fifth) on light, and Light 2
// (the second) on dark.
func accentFromPalette(b []byte) *Accent {
	if len(b) < 32 {
		return nil
	}
	hex := func(i int) string { return fmt.Sprintf("#%02x%02x%02x", b[i*4], b[i*4+1], b[i*4+2]) }
	return &Accent{Light: hex(4), Dark: hex(1)}
}

// macAccents are macOS's accent colours by AppleAccentColor, as its
// system colours on light and on dark. Blue (4, or no value: Multicolor)
// is the Mac's own, so it is not listed.
var macAccents = map[string]Accent{
	"-1": {Light: "#8e8e93", Dark: "#98989d"},               // graphite
	"0":  {Light: "#ff3b30", Dark: "#ff453a"},               // red
	"1":  {Light: "#ff9500", Dark: "#ff9f0a"},               // orange
	"2":  {Light: "#ffcc00", Dark: "#ffd60a", Text: "#000"}, // yellow
	"3":  {Light: "#28cd41", Dark: "#30d158"},               // green
	"5":  {Light: "#af52de", Dark: "#bf5af2"},               // purple
	"6":  {Light: "#ff2d55", Dark: "#ff375f"},               // pink
}

// macAccent is the accent for `defaults read -g AppleAccentColor`.
func macAccent(value string) *Accent {
	if a, ok := macAccents[strings.TrimSpace(value)]; ok {
		return &a
	}
	return nil
}

// gnomeAccents are libadwaita's accent colours (GNOME 47 and later) by
// org.gnome.desktop.interface accent-color. Blue is GNOME's own.
var gnomeAccents = map[string]string{
	"teal": "#2190a4", "green": "#3a944a", "yellow": "#c88800", "orange": "#ed5b00",
	"red": "#e62d42", "pink": "#d56199", "purple": "#9141ac", "slate": "#6f8396",
}

// gnomeAccent is the accent for `gsettings get ... accent-color` ('teal').
// On dark, libadwaita draws accent text a third of the way to white.
func gnomeAccent(value string) *Accent {
	c, ok := gnomeAccents[strings.Trim(strings.TrimSpace(value), "'")]
	if !ok {
		return nil
	}
	return &Accent{Light: c, Dark: toward(c, 0.33)}
}

// kdeAccent is the accent in KDE's kdeglobals, from its [General]
// AccentColor ("61,174,233") or, without one, the colour scheme's
// selection ([Colors:Selection] BackgroundNormal).
func kdeAccent(kdeglobals string) *Accent {
	section, general, selection := "", "", ""
	for _, line := range strings.Split(kdeglobals, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") {
			section = line
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		switch {
		case section == "[General]" && k == "AccentColor":
			general = v
		case section == "[Colors:Selection]" && k == "BackgroundNormal":
			selection = v
		}
	}
	rgb := general
	if rgb == "" {
		rgb = selection
	}
	parts := strings.Split(rgb, ",")
	if len(parts) < 3 {
		return nil
	}
	var b [3]int
	for i := range b {
		n, err := strconv.Atoi(strings.TrimSpace(parts[i]))
		if err != nil || n < 0 || n > 255 {
			return nil
		}
		b[i] = n
	}
	c := fmt.Sprintf("#%02x%02x%02x", b[0], b[1], b[2])
	if c == "#3daee9" { // Breeze's own blue
		return nil
	}
	return &Accent{Light: c, Dark: toward(c, 0.2)}
}

// toward moves a #rrggbb colour this share of the way to white.
func toward(c string, share float64) string {
	v, err := strconv.ParseUint(strings.TrimPrefix(c, "#"), 16, 32)
	if err != nil {
		return c
	}
	ch := func(shift uint) int {
		x := float64((v >> shift) & 0xff)
		return int(x + (255-x)*share + 0.5)
	}
	return fmt.Sprintf("#%02x%02x%02x", ch(16), ch(8), ch(0))
}

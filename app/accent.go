package main

import "fmt"

// Accent is the colour the person picked for their system (Windows'
// Settings › Personalization › Colors), in the shades the system itself
// uses for buttons and links on a light and on a dark background. The
// page uses it in place of its own blue (style.css, html.sys-accent).
type Accent struct {
	Light string `json:"light"` // "#0067c0"
	Dark  string `json:"dark"`  // "#4cc2ff"
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

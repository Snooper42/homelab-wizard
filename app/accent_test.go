package main

import "testing"

func TestAccentFromPalette(t *testing.T) {
	// Windows 11's default blue.
	blue := []byte{0x99, 0xeb, 0xff, 0, 0x4c, 0xc2, 0xff, 0, 0x00, 0x91, 0xf8, 0, 0x00, 0x78, 0xd4, 0, 0x00, 0x67, 0xc0, 0, 0x00, 0x3e, 0x92, 0, 0x00, 0x1a, 0x68, 0, 0xf7, 0x63, 0x0c, 0}
	if a := accentFromPalette(blue); a == nil || a.Light != "#0067c0" || a.Dark != "#4cc2ff" {
		t.Errorf("blue: %+v", a)
	}
	if a := accentFromPalette(blue[:12]); a != nil {
		t.Errorf("short palette: %+v", a)
	}
}

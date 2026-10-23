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

func TestMacAccent(t *testing.T) {
	if a := macAccent("5\n"); a == nil || a.Light != "#af52de" || a.Dark != "#bf5af2" {
		t.Errorf("purple: %+v", a)
	}
	if a := macAccent("2"); a == nil || a.Text != "#000" {
		t.Errorf("yellow takes dark text: %+v", a)
	}
	if a := macAccent("4"); a != nil {
		t.Errorf("blue is the Mac's own: %+v", a)
	}
}

func TestGnomeAccent(t *testing.T) {
	if a := gnomeAccent("'teal'\n"); a == nil || a.Light != "#2190a4" || a.Dark != toward("#2190a4", 0.33) {
		t.Errorf("teal: %+v", a)
	}
	if a := gnomeAccent("'blue'"); a != nil {
		t.Errorf("blue is GNOME's own: %+v", a)
	}
	// GNOME's blue a third of the way to white: within one step of
	// libadwaita's own dark blue, #78aeed.
	if got := toward("#3584e4", 0.33); got != "#78aded" {
		t.Errorf("toward: %s", got)
	}
}

func TestKDEAccent(t *testing.T) {
	ini := "[Colors:Selection]\nBackgroundNormal=61,174,233\n\n[General]\nAccentColor=233,100,61\nColorScheme=BreezeDark\n"
	if a := kdeAccent(ini); a == nil || a.Light != "#e9643d" {
		t.Errorf("accent: %+v", a)
	}
	if a := kdeAccent("[Colors:Selection]\nBackgroundNormal=146,110,228\n"); a == nil || a.Light != "#926ee4" {
		t.Errorf("selection only: %+v", a)
	}
	if a := kdeAccent("[General]\nAccentColor=61,174,233\n"); a != nil {
		t.Errorf("Breeze's own blue: %+v", a)
	}
	if a := kdeAccent("[General]\nColorScheme=Breeze\n"); a != nil {
		t.Errorf("no accent: %+v", a)
	}
}

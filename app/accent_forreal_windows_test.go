//go:build forreal

package main

import (
	"testing"

	"golang.org/x/sys/windows/registry"
)

// The accent picked in Settings › Personalization › Colors, written for
// real where Windows keeps it (AccentPalette) and read back, then put back
// as it was.
func TestAccentReadForReal(t *testing.T) {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Explorer\Accent`, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		t.Fatal(err)
	}
	defer k.Close()
	before, _, beforeErr := k.GetBinaryValue("AccentPalette")
	t.Cleanup(func() {
		if beforeErr != nil {
			_ = k.DeleteValue("AccentPalette")
		} else {
			_ = k.SetBinaryValue("AccentPalette", before)
		}
	})
	// Eight colours, lightest first: a green one.
	palette := []byte{
		0xa8, 0xf0, 0xb8, 0, 0x76, 0xe0, 0x8f, 0, 0x3c, 0xc8, 0x5e, 0, 0x10, 0x7c, 0x10, 0,
		0x0b, 0x5e, 0x0b, 0, 0x06, 0x40, 0x06, 0, 0x03, 0x2a, 0x03, 0, 0x88, 0x17, 0x98, 0,
	}
	if err := k.SetBinaryValue("AccentPalette", palette); err != nil {
		t.Fatal(err)
	}
	got, want := systemAccent(), accentFromPalette(palette)
	if got == nil || want == nil || *got != *want {
		t.Fatalf("the accent reads %+v, want %+v", got, want)
	}
}

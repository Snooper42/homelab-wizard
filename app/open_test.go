package main

import "testing"

func TestWebLink(t *testing.T) {
	for link, want := range map[string]bool{
		"https://github.com/immich-app/immich/releases": true,
		"http://192.168.1.10:8099/":                     true,
		"mailto:helper@example.com?subject=Homelab":     true,
		"file:///Applications/Calculator.app":           false,
		"javascript:alert(1)":                           false,
		"smb://nas/share":                               false,
		"https:///nothing":                              false,
		"":                                              false,
	} {
		if got := webLink(link); got != want {
			t.Errorf("webLink(%q) = %v, want %v", link, got, want)
		}
	}
}

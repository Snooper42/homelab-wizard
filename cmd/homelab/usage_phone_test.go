package main

import "testing"

// The web page's Analytics reads each app's processor and memory every 10 seconds (the owner, Nov 26: without it,
// Analytics "breaks on the web page"): a look-only call for the owner's phones and wall screens, as the usage card,
// not a household member's.
func TestUsageOnAPhone(t *testing.T) {
	h := &homelab{root: t.TempDir()}
	m, ok := h.phoneMethods()["Usage"]
	if !ok || m.Member || m.Change {
		t.Errorf("Usage: %+v (a look-only call for the owner's phones)", m)
	}
}

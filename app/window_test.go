package main

import "testing"

func TestWindowSize(t *testing.T) {
	for _, c := range []struct {
		s            windowState
		sw, sh       int
		wantW, wantH int
	}{
		{windowState{}, 0, 0, defaultWidth, defaultHeight},
		{windowState{Width: 1400, Height: 900}, 0, 0, 1400, 900},
		{windowState{Width: 500, Height: 900}, 0, 0, defaultWidth, defaultHeight},
		{windowState{Width: 2400, Height: 1500}, 1440, 900, 1440, 900},
	} {
		if w, h := c.s.size(c.sw, c.sh); w != c.wantW || h != c.wantH {
			t.Errorf("%+v on %dx%d: %dx%d, want %dx%d", c.s, c.sw, c.sh, w, h, c.wantW, c.wantH)
		}
	}
}

func TestWindowPlaced(t *testing.T) {
	for _, c := range []struct {
		s    windowState
		want bool
	}{
		{windowState{X: 120, Y: 80}, true},
		{windowState{}, false},                // Wayland reports 0,0
		{windowState{X: 2000, Y: 80}, false},  // on a display unplugged since
		{windowState{X: -1500, Y: 80}, false}, // left of the main display
		{windowState{X: 100, Y: 880}, false},  // below the bottom edge
	} {
		if got := c.s.placed(1180, 780, 1440, 900); got != c.want {
			t.Errorf("%+v: placed %v, want %v", c.s, got, c.want)
		}
	}
}

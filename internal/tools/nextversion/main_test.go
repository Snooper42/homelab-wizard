package main

import "testing"

func TestNext(t *testing.T) {
	old := []string{"v0.16.5", "v0.16.6", "v0.16.8", "v0.16.41", "nightly", "v0.9.4-beta"}
	for _, c := range []struct {
		name, floor string
		tags, here  []string
		want        string
	}{
		{"the first of a new minor", "0.17.0", old, nil, "0.17.0"},
		{"one more than the last", "0.17.0", append(old, "v0.17.0"), nil, "0.17.1"},
		{"tags out of order", "0.17.0", append([]string{"v0.17.3", "v0.17.10x", "v0.17.9"}, old...), nil, "0.17.10"},
		{"after .10, the next minor", "0.17.0", append(old, "v0.17.9", "v0.17.10"), nil, "0.18.0"},
		{"and on from there", "0.17.0", append(old, "v0.17.10", "v0.18.0"), nil, "0.18.1"},
		{"VERSION raised to a new major", "1.0.0", append(old, "v0.18.4"), nil, "1.0.0"},
		{"VERSION behind, and already past .10", "0.16.0", old, nil, "0.17.0"},
		{"VERSION behind the releases", "0.16.0", []string{"v0.16.3"}, nil, "0.16.4"},
		{"VERSION asks for a later patch", "0.17.5", append(old, "v0.17.1"), nil, "0.17.5"},
		{"nothing released yet", "0.1.0", nil, nil, "0.1.0"},
		{"a re-run keeps its number", "0.17.0", append(old, "v0.17.0", "v0.17.1"), []string{"v0.17.0"}, "0.17.0"},
		{"a re-run's other tags are no number", "0.17.0", append(old, "v0.17.0"), []string{"nightly"}, "0.17.1"},
	} {
		got, err := next(c.floor, c.tags, c.here)
		if err != nil || got != c.want {
			t.Errorf("%s: %q %v, want %q", c.name, got, err, c.want)
		}
	}
	if _, err := next("0.17", nil, nil); err == nil {
		t.Error("a VERSION that is no version")
	}
}

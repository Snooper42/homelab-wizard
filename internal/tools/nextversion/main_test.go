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

// A version cut by hand (docs/Release Process.md): patch is one more, past
// .10 too; minor is the next minor at .0; beta is the next minor's next
// beta. VERSION stays the floor, and a re-run keeps its number. A beta tag
// never moves the numbering: the next patch or minor counts from the newest
// numbered release.
func TestCut(t *testing.T) {
	tags := []string{"v0.47.5", "v0.47.10", "v0.46.10", "nightly", "v0.9.4-beta"}
	for _, c := range []struct {
		name, kind, floor string
		tags, here        []string
		want              string
	}{
		{"a patch", "patch", "0.17.0", tags, nil, "0.47.11"},
		{"a patch past .10 stays in the minor", "patch", "0.17.0", []string{"v0.48.10"}, nil, "0.48.11"},
		{"a minor", "minor", "0.17.0", tags, nil, "0.48.0"},
		{"the first beta of the next minor", "beta", "0.17.0", tags, nil, "0.48.0-beta.1"},
		{"the next beta", "beta", "0.17.0", append(tags, "v0.48.0-beta.1", "v0.48.0-beta.2"), nil, "0.48.0-beta.3"},
		{"betas don't move the numbering", "minor", "0.17.0", append(tags, "v0.48.0-beta.2"), nil, "0.48.0"},
		{"after the minor, its beta line starts again", "beta", "0.17.0", append(tags, "v0.48.0-beta.2", "v0.48.0"), nil, "0.49.0-beta.1"},
		{"VERSION a newer minor", "minor", "1.0.0", tags, nil, "1.0.0"},
		{"VERSION a newer minor, as a beta", "beta", "1.0.0", tags, nil, "1.0.0-beta.1"},
		{"nothing released yet", "patch", "0.1.0", nil, nil, "0.1.0"},
		{"a re-run keeps its number", "minor", "0.17.0", tags, []string{"v0.47.10"}, "0.47.10"},
		{"a beta's re-run too", "beta", "0.17.0", append(tags, "v0.48.0-beta.1"), []string{"v0.48.0-beta.1"}, "0.48.0-beta.1"},
	} {
		got, err := cut(c.kind, c.floor, c.tags, c.here)
		if err != nil || got != c.want {
			t.Errorf("%s: %q %v, want %q", c.name, got, err, c.want)
		}
	}
	if _, err := cut("major", "0.17.0", tags, nil); err == nil {
		t.Error("a kind that isn't patch, minor or beta")
	}
}

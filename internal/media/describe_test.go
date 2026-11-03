package media

import "testing"

// Removing the extra copies leaves a line in Recently done; finding none leaves none.
func TestDescribeDedupe(t *testing.T) {
	text, sub := Describe("movies", Run{Action: "dedupe", OK: true, Result: map[string]any{"removed": float64(3), "freed": float64(13e9)}})
	if text != "Extra copies in the Trash" || sub != "3 copies · 13 GB freed" {
		t.Errorf("got %q, %q", text, sub)
	}
	if text, _ := Describe("tv", Run{Action: "dedupe", OK: true, Result: map[string]any{"removed": float64(0)}}); text != "" {
		t.Errorf("nothing removed: %q", text)
	}
}

package board

import (
	"context"
	"errors"
	"testing"
	"time"
)

// Each card comes as soon as it is read: the quick one first, whatever the
// order asked; one that fails says why; one not here says so.
func TestRead(t *testing.T) {
	r := Readers{
		"slow":  func(context.Context) (any, error) { time.Sleep(150 * time.Millisecond); return "late", nil },
		"quick": func(context.Context) (any, error) { return 1, nil },
		"bad":   func(context.Context) (any, error) { return nil, errors.New("CrowdSec is not running") },
	}
	var got []Card
	start := time.Now()
	var quickAt time.Duration
	Read(context.Background(), r, 7, []string{"slow", "quick", "bad", "elsewhere", "quick"}, func(c Card) {
		if c.Name == "quick" {
			quickAt = time.Since(start)
		}
		got = append(got, c)
	})
	if len(got) != 4 {
		t.Fatalf("%+v", got)
	}
	if quickAt > 100*time.Millisecond {
		t.Errorf("the quick card waited for the slow one: %v", quickAt)
	}
	by := map[string]Card{}
	for _, c := range got {
		if c.Board != 7 {
			t.Errorf("board %d", c.Board)
		}
		by[c.Name] = c
	}
	if by["slow"].Data != "late" || by["quick"].Data != 1 || by["bad"].Error != "CrowdSec is not running" || by["elsewhere"].Error != NotHere {
		t.Errorf("%+v", by)
	}
	if got[len(got)-1].Name != "slow" {
		t.Errorf("the slow card was not last: %+v", got)
	}
}

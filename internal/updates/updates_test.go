package updates

import "testing"

func TestState(t *testing.T) {
	if s := Get(map[string]string{"WATCHTOWER_SCHEDULE": "0 30 3 * * *"}); s.Paused || s.Schedule != "daily at 03:30" {
		t.Errorf("%+v", s)
	}
	if s := Get(map[string]string{PausedKey: "true"}); !s.Paused || s.Schedule != "daily at 04:00" {
		t.Errorf("%+v", s)
	}
	if got := Describe("0 0 4 * * 0"); got != "on schedule 0 0 4 * * 0" {
		t.Errorf("%q", got)
	}
}

func TestAt(t *testing.T) {
	for _, c := range []struct {
		cron string
		h, m int
	}{
		{"", 4, 0}, {"0 0 4 * * *", 4, 0}, {"0 30 2 * * *", 2, 30}, {"0 15 23 * * 1", 23, 15},
		{"0 0 25 * * *", 4, 0}, {"@daily", 4, 0}, {"0 x 4 * * *", 4, 0},
	} {
		if h, m := At(c.cron); h != c.h || m != c.m {
			t.Errorf("At(%q) = %d:%02d, want %d:%02d", c.cron, h, m, c.h, c.m)
		}
	}
}

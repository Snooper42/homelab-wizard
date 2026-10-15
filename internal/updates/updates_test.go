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

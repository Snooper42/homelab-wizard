package updates

import (
	"slices"
	"testing"
	"time"
)

func TestParseDays(t *testing.T) {
	for in, want := range map[string][]time.Weekday{
		"sun":                         {time.Sunday},
		"Sundays":                     {time.Sunday},
		"sat+sun":                     {time.Saturday, time.Sunday},
		"sunday, saturday":            {time.Saturday, time.Sunday},
		"weekend":                     {time.Saturday, time.Sunday},
		"tues":                        {time.Tuesday},
		"fri mon wed":                 {time.Monday, time.Wednesday, time.Friday},
		"every":                       nil,
		"":                            nil,
		"mon+tue+wed+thu+fri+sat+sun": nil,
	} {
		got, err := ParseDays(in)
		if err != nil || !slices.Equal(got, want) {
			t.Errorf("ParseDays(%q) = %v, %v; want %v", in, got, err, want)
		}
	}
	for _, in := range []string{"su", "funday", "sun+someday"} {
		if _, err := ParseDays(in); err == nil {
			t.Errorf("ParseDays(%q) read it as days", in)
		}
	}
}

func TestDaysInEnv(t *testing.T) {
	env := map[string]string{DaysKey: "immich:sun, nextcloud:sat+sun,broken,jellyfin:funday"}
	d := Days(env)
	if len(d) != 2 || !slices.Equal(d["immich"], []time.Weekday{time.Sunday}) || !slices.Equal(d["nextcloud"], []time.Weekday{time.Saturday, time.Sunday}) {
		t.Fatalf("Days = %v", d)
	}
	if DueOn(env, "immich", time.Saturday) || !DueOn(env, "immich", time.Sunday) || !DueOn(env, "sonarr", time.Saturday) {
		t.Error("DueOn")
	}
	if got := SetDays(env, "vaultwarden", []time.Weekday{time.Monday, time.Thursday}); got != "immich:sun,nextcloud:sat+sun,vaultwarden:mon+thu" {
		t.Errorf("SetDays added: %q", got)
	}
	if got := SetDays(env, "immich", nil); got != "nextcloud:sat+sun" {
		t.Errorf("SetDays every night: %q", got)
	}
	if got := SetDays(map[string]string{}, "immich", []time.Weekday{time.Sunday}); got != "immich:sun" {
		t.Errorf("SetDays on nothing: %q", got)
	}
}

func TestDaysText(t *testing.T) {
	for want, days := range map[string][]time.Weekday{
		"every night":                     nil,
		"Sundays":                         {time.Sunday},
		"Saturdays and Sundays":           {time.Saturday, time.Sunday},
		"Mondays, Wednesdays and Fridays": {time.Monday, time.Wednesday, time.Friday},
	} {
		if got := DaysText(days); got != want {
			t.Errorf("DaysText(%v) = %q, want %q", days, got, want)
		}
	}
}

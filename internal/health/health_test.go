package health

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestCheckAndState(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login":
			http.Redirect(w, r, "/elsewhere", http.StatusFound)
		case "/down":
			w.WriteHeader(http.StatusBadGateway)
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	defer srv.Close()
	ctx := context.Background()
	client := &http.Client{Timeout: time.Second}
	results := []Result{
		Check(ctx, client, "app", srv.URL+"/"),
		Check(ctx, client, "login", srv.URL+"/login"),
		Check(ctx, client, "down", srv.URL+"/down"),
		Check(ctx, client, "gone", "http://127.0.0.1:1/"),
	}
	for i, want := range []bool{true, true, false, false} {
		if results[i].OK() != want {
			t.Errorf("%s: ok=%v (%d %v)", results[i].Name, results[i].OK(), results[i].Status, results[i].Err)
		}
	}

	path := filepath.Join(t.TempDir(), "state.json")
	s := LoadState(path)
	failed, recovered := s.Update(results, time.Now())
	if len(failed) != 0 || len(recovered) != 0 || len(s.Pending) != 2 {
		t.Fatalf("one failing run should only be pending: failed %v recovered %v pending %v", failed, recovered, s.Pending)
	}
	failed, recovered = s.Update(results, time.Now())
	if len(failed) != 2 || len(recovered) != 0 || !s.Confirmed("down") {
		t.Fatalf("second failing run: failed %v recovered %v", failed, recovered)
	}
	if err := s.Save(path); err != nil {
		t.Fatal(err)
	}
	s = LoadState(path)
	results[2] = Result{Name: "down", Status: 200}
	failed, recovered = s.Update(results, time.Now())
	if len(failed) != 0 || len(recovered) != 1 || recovered[0] != "down" {
		t.Fatalf("second run should only report the recovery: failed %v recovered %v", failed, recovered)
	}
}

func TestHeartbeatHidesItsURL(t *testing.T) {
	err := Heartbeat(context.Background(), http.DefaultClient, "http://127.0.0.1:1/ping/secret-uuid", nil)
	if err == nil || strings.Contains(err.Error(), "secret-uuid") {
		t.Fatalf("Heartbeat error should not carry the URL: %v", err)
	}
}

func TestBlipThenRecoveryIsQuiet(t *testing.T) {
	s := LoadState(filepath.Join(t.TempDir(), "none.json"))
	failed, _ := s.Update([]Result{{Name: "app", Err: errors.New("down")}}, time.Now())
	_, recovered := s.Update([]Result{{Name: "app", Status: 200}}, time.Now())
	if len(failed) != 0 || len(recovered) != 0 || len(s.Pending) != 0 {
		t.Fatalf("a single blip should neither alert nor recover: %v %v %v", failed, recovered, s.Pending)
	}
}

func TestSummaryKeepsTheLastRun(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	s := LoadState(path)
	if sum := s.Summary(); !sum.LastRun.IsZero() || len(sum.Failing) != 0 {
		t.Fatalf("a watchdog that never ran: %+v", sum)
	}
	t1 := time.Date(2026, 10, 11, 9, 0, 0, 0, time.UTC)
	results := []Result{{Name: "vaultwarden", Status: 200}, {Name: "crowdsec bouncer", Err: errors.New("no pull for 9 minutes")}, {Name: "photos.example.com", Status: 502}}
	s.Update(results, t1)
	s.Update(results, t1.Add(15*time.Minute))
	if err := s.Save(path); err != nil {
		t.Fatal(err)
	}
	sum := LoadState(path).Summary()
	if !sum.LastRun.Equal(t1.Add(15*time.Minute)) || sum.Checks != 3 || sum.Pending != 0 {
		t.Fatalf("summary = %+v", sum)
	}
	if len(sum.Failing) != 2 || sum.Failing[0].Name != "crowdsec bouncer" || sum.Failing[0].Problem != "no pull for 9 minutes" || sum.Failing[1].Problem != "HTTP 502" {
		t.Fatalf("failing = %+v", sum.Failing)
	}
	// Recovered checks leave the list and their messages.
	s.Update([]Result{{Name: "vaultwarden", Status: 200}, {Name: "crowdsec bouncer", Status: 200}, {Name: "photos.example.com", Status: 200}}, t1.Add(30*time.Minute))
	if sum := s.Summary(); len(sum.Failing) != 0 || len(s.Problems) != 0 {
		t.Fatalf("after recovery: %+v %v", sum, s.Problems)
	}
}

func TestWeek(t *testing.T) {
	var s State
	start := time.Date(2026, 10, 1, 12, 0, 0, 0, time.Local)
	ok := Result{Name: "app", Status: 200}
	bad := Result{Name: "app", Err: errors.New("down")}
	s.Update([]Result{ok}, start)
	s.Update([]Result{ok}, start.Add(time.Hour))
	s.Update([]Result{bad}, start.AddDate(0, 0, 1))
	s.Update([]Result{ok}, start.AddDate(0, 0, 1).Add(time.Hour))
	if w := s.Week()["app"]; w != 0.75 {
		t.Fatalf("week %v", w)
	}
	// Each day's runs go to the app's page, which draws the week's bars.
	if d := s.Summary().Days["app"]; d["2026-10-01"] != [2]int{2, 2} || d["2026-10-02"] != [2]int{1, 2} {
		t.Fatalf("days %v", d)
	}
	// Eight days on, the week is that day alone, but the first two days are still kept: fourteen days are, for the
	// Overview's squares (lane D, D3).
	s.Update([]Result{ok}, start.AddDate(0, 0, 8))
	if w := s.Week()["app"]; w != 1 || len(s.Days["app"]) != 3 {
		t.Fatalf("week %v, days %v", w, s.Days["app"])
	}
	// Fifteen days on, they're gone.
	s.Update([]Result{ok}, start.AddDate(0, 0, 15))
	if w := s.Week()["app"]; w != 1 || len(s.Days["app"]) != 2 {
		t.Fatalf("week %v, days %v", w, s.Days["app"])
	}
}

// Lane D, D3: the last fourteen days, oldest first, each with how many checks were down at some point that day (a
// blip that passed the next run is not down, as it is no alert) and how many runs there were.
func TestSummaryFourteenDays(t *testing.T) {
	var s State
	start := time.Date(2026, 11, 1, 10, 0, 0, 0, time.Local)
	ok, bad := Result{Name: "app", Status: 200}, Result{Name: "app", Err: errors.New("down")}
	other, otherBad := Result{Name: "other", Status: 200}, Result{Name: "other", Err: errors.New("down")}
	s.Update([]Result{ok, other}, start)
	// Day 2: app down for 30 minutes, other blips once.
	d2 := start.AddDate(0, 0, 1)
	s.Update([]Result{bad, otherBad}, d2)
	s.Update([]Result{bad, other}, d2.Add(15*time.Minute))
	s.Update([]Result{ok, other}, d2.Add(30*time.Minute))
	// Day 5, late: both down, overnight (the machine asleep), until day 6.
	d5 := start.AddDate(0, 0, 4).Add(13 * time.Hour)
	s.Update([]Result{bad, otherBad}, d5)
	s.Update([]Result{bad, otherBad}, d5.Add(15*time.Minute))
	s.Update([]Result{ok, other}, d5.Add(12*time.Hour))
	// Day 14: all well.
	s.Update([]Result{ok, other}, start.AddDate(0, 0, 13))
	now := start.AddDate(0, 0, 13).Add(time.Hour)
	sum := s.SummaryAt(now)
	if len(sum.Daily) != 14 {
		t.Fatalf("%d days: %+v", len(sum.Daily), sum.Daily)
	}
	if sum.Daily[0].Date != "2026-11-01" || sum.Daily[13].Date != "2026-11-14" {
		t.Errorf("from %s to %s", sum.Daily[0].Date, sum.Daily[13].Date)
	}
	want := map[string]int{"2026-11-02": 1, "2026-11-05": 2, "2026-11-06": 2}
	for _, d := range sum.Daily {
		if d.Failed != want[d.Date] {
			t.Errorf("%s: %d down, want %d", d.Date, d.Failed, want[d.Date])
		}
	}
	if sum.Daily[0].Runs != 2 || sum.Daily[1].Runs != 6 || sum.Daily[12].Runs != 0 || sum.Daily[13].Runs != 2 {
		t.Errorf("runs: %+v", sum.Daily)
	}
	// "% up this week" is still the last seven days: day 14's run alone, though five days are kept.
	if w := s.Week(); w["app"] != 1 || w["other"] != 1 || len(s.Days["app"]) != 5 {
		t.Errorf("week: %v, days %v", w, s.Days["app"])
	}
	// Still down: today counts it.
	s.Update([]Result{bad, other}, now)
	s.Update([]Result{bad, other}, now.Add(15*time.Minute))
	if d := s.SummaryAt(now.Add(20 * time.Minute)).Daily; d[13].Failed != 1 {
		t.Errorf("down now: %+v", d[13])
	}
	// A state from before (no runs kept) still makes fourteen days, all clear.
	if d := (State{}).SummaryAt(now).Daily; len(d) != 14 || d[13].Failed != 0 || d[13].Runs != 0 {
		t.Errorf("an old state: %+v", d)
	}
}

func TestForget(t *testing.T) {
	root := t.TempDir()
	path := StatePath(root)
	if want := filepath.Join(root, "scripts", "logs", "watchdog-state.json"); path != want {
		t.Fatalf("state path %s, want %s", path, want)
	}
	s := LoadState(path)
	bad := []Result{{Name: "gone", Err: errors.New("down")}, {Name: "kept", Err: errors.New("down")}}
	s.Update(bad, time.Now())
	s.Update(bad, time.Now())
	s.Forget("gone")
	if err := s.Save(path); err != nil {
		t.Fatal(err)
	}
	s = LoadState(path)
	if s.Confirmed("gone") || s.Problems["gone"] != "" || s.Days["gone"] != nil {
		t.Fatalf("gone is still in the state: %+v", s)
	}
	if !s.Confirmed("kept") || s.Days["kept"] == nil {
		t.Fatalf("forgetting one app dropped another: %+v", s)
	}
}

func TestPlain(t *testing.T) {
	for in, want := range map[string]string{
		"dial tcp: connect: connection refused": "nothing answers on its port",
		"context deadline exceeded":             "no answer in time",
		"i/o timeout":                           "no answer in time",
		"read: connection reset by peer":        "the connection was reset",
		"tls: bad certificate":                  "tls: bad certificate",
	} {
		if got := plain(errors.New(in)).Error(); got != want {
			t.Errorf("plain(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOutages(t *testing.T) {
	start := time.Date(2026, 10, 1, 3, 0, 0, 0, time.Local)
	ok := Result{Name: "app", Status: 200}
	refused := Result{Name: "app", Err: errors.New("nothing answers on its port")}
	gone := Result{Name: "app", Status: 502}
	at := func(m int) time.Time { return start.Add(time.Duration(m) * time.Minute) }
	for _, tc := range []struct {
		name string
		runs []Result // one every 15 minutes from start
		want []Outage
	}{
		{"up all along", []Result{ok, ok, ok}, nil},
		{"a blip is no outage", []Result{ok, refused, ok}, nil},
		{"down from the first failing run to the run that passed, with what it said last",
			[]Result{ok, refused, refused, gone, ok}, []Outage{{From: at(15), To: at(60), Problem: "HTTP 502"}}},
		{"still down: no end yet", []Result{ok, refused, refused}, []Outage{{From: at(15), Problem: "nothing answers on its port"}}},
		{"two in a row, oldest first", []Result{refused, refused, ok, gone, gone, ok},
			[]Outage{{From: at(0), To: at(30), Problem: "nothing answers on its port"}, {From: at(45), To: at(75), Problem: "HTTP 502"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var s State
			for i, r := range tc.runs {
				s.Update([]Result{r}, at(15*i))
			}
			if got := s.Summary().Outages["app"]; !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("outages\n got %+v\nwant %+v", got, tc.want)
			}
		})
	}
	// Two weeks on, an outage that ended is gone; one still going stays.
	var s State
	s.Update([]Result{refused, {Name: "other", Err: errors.New("down")}}, at(0))
	s.Update([]Result{refused, {Name: "other", Err: errors.New("down")}}, at(15))
	s.Update([]Result{ok, {Name: "other", Err: errors.New("down")}}, at(30))
	s.Update([]Result{ok, {Name: "other", Err: errors.New("down")}}, start.AddDate(0, 0, 8))
	if o := s.Outages; len(o["app"]) != 1 {
		t.Fatalf("eight days on, the outage is still kept: %+v", o)
	}
	s.Update([]Result{ok, {Name: "other", Err: errors.New("down")}}, start.AddDate(0, 0, 15))
	if o := s.Outages; o["app"] != nil || len(o["other"]) != 1 || !o["other"][0].To.IsZero() {
		t.Fatalf("two weeks on: %+v", o)
	}
	// A check no longer run ends its outage at the last run that saw it; Forget drops it.
	s.Update([]Result{ok}, start.AddDate(0, 0, 15).Add(15*time.Minute))
	if o := s.Outages["other"]; len(o) != 1 || !o[0].To.Equal(start.AddDate(0, 0, 15)) {
		t.Fatalf("no longer run: %+v", o)
	}
	s.Forget("other")
	if s.Outages["other"] != nil {
		t.Fatalf("forgotten: %+v", s.Outages)
	}
}

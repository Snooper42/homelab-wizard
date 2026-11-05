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
	// Eight days on, the first two days are gone.
	s.Update([]Result{ok}, start.AddDate(0, 0, 8))
	if w := s.Week()["app"]; w != 1 || len(s.Days["app"]) != 1 {
		t.Fatalf("week %v, days %v", w, s.Days["app"])
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
	// A week on, an outage that ended is gone; one still going stays.
	var s State
	s.Update([]Result{refused, {Name: "other", Err: errors.New("down")}}, at(0))
	s.Update([]Result{refused, {Name: "other", Err: errors.New("down")}}, at(15))
	s.Update([]Result{ok, {Name: "other", Err: errors.New("down")}}, at(30))
	s.Update([]Result{ok, {Name: "other", Err: errors.New("down")}}, start.AddDate(0, 0, 8))
	if o := s.Outages; o["app"] != nil || len(o["other"]) != 1 || !o["other"][0].To.IsZero() {
		t.Fatalf("a week on: %+v", o)
	}
	// A check no longer run ends its outage at the last run that saw it; Forget drops it.
	s.Update([]Result{ok}, start.AddDate(0, 0, 8).Add(15*time.Minute))
	if o := s.Outages["other"]; len(o) != 1 || !o[0].To.Equal(start.AddDate(0, 0, 8)) {
		t.Fatalf("no longer run: %+v", o)
	}
	s.Forget("other")
	if s.Outages["other"] != nil {
		t.Fatalf("forgotten: %+v", s.Outages)
	}
}

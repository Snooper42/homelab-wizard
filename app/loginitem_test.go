package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/schedule"
)

// fakeJobs is launchd for the switch: the agent's job loaded or not, and
// what was done to it.
type fakeJobs struct {
	loaded bool
	did    []string
}

func (f *fakeJobs) Status(string) schedule.Status {
	return schedule.Status{Installed: f.loaded, Loaded: f.loaded}
}
func (f *fakeJobs) Remove(string) error {
	f.did = append(f.did, "remove")
	f.loaded = false
	return nil
}
func (f *fakeJobs) Enable(string) { f.did = append(f.did, "enable") }

// The agent moves from its launchd job to the app's login item only once
// the jobs run, and comes back to the launchd job when the login item does
// not end up enabled, so the homelab always has its agent.
func TestLoginItem(t *testing.T) {
	run := func(state int, loaded bool, registers int, setErr error) (string, *fakeJobs, []string) {
		jobs := &fakeJobs{loaded: loaded}
		var calls []string
		li := loginItem{jobs: jobs,
			state: func() int { return state },
			set: func(on bool) error {
				if on {
					calls = append(calls, "register")
					if setErr != nil {
						return setErr
					}
					state = registers
					return nil
				}
				calls = append(calls, "unregister")
				state = itemNotRegistered
				return nil
			},
			fallback: func() error { calls = append(calls, "schedule install"); return nil }}
		return li.use(), jobs, calls
	}
	if got, jobs, calls := run(itemNotRegistered, true, itemEnabled, nil); got != "registered" || strings.Join(jobs.did, " ") != "remove enable" || strings.Join(calls, " ") != "register" {
		t.Errorf("switched: %q, launchd %q, calls %q", got, jobs.did, calls)
	}
	// Before Setup installs the jobs, or while Quit has stopped the agent.
	if got, jobs, calls := run(itemNotRegistered, false, itemEnabled, nil); got != "" || len(jobs.did) != 0 || len(calls) != 0 {
		t.Errorf("jobs not running: %q, %q, %q", got, jobs.did, calls)
	}
	for _, c := range []struct {
		name  string
		after int
		err   error
	}{{"refused", itemNotRegistered, errors.New("Operation not permitted")}, {"waiting for approval", itemRequiresApproval, nil}} {
		got, _, calls := run(itemNotRegistered, true, c.after, c.err)
		if strings.Join(calls, " ") != "register unregister schedule install" || !strings.HasSuffix(got, "the launchd job again") {
			t.Errorf("%s: %q, calls %q", c.name, got, calls)
		}
	}
	// One left waiting for approval from before: back to the launchd job.
	if got, _, calls := run(itemRequiresApproval, false, itemEnabled, nil); strings.Join(calls, " ") != "unregister schedule install" || !strings.Contains(got, "approval") {
		t.Errorf("waiting from before: %q, %q", got, calls)
	}
	// Done already, macOS 12, or a build without it: nothing to do.
	for _, st := range []int{itemEnabled, itemNone, itemNotFound} {
		if got, jobs, calls := run(st, true, itemEnabled, nil); got != "" || len(jobs.did)+len(calls) != 0 {
			t.Errorf("state %d: %q, %q, %q", st, got, jobs.did, calls)
		}
	}
}

// The login item's plist (fixed in the app) is the same job as homelab
// schedule install's: the agent's label, kept running, started at login.
func TestLoginItemPlistIsTheAgentsJob(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("agent", schedule.LoginItemPlist))
	if err != nil {
		t.Fatal(err)
	}
	job := schedule.Jobs()[0]
	text := string(data)
	for _, want := range []string{
		"<key>Label</key>\n\t<string>" + job.Label + "</string>",
		"<string>Contents/Library/LoginItems/Homelab Wizard Agent.app/Contents/MacOS/homelab</string>",
		"<string>" + job.Args[0] + "</string>\n\t\t<string>--login-item</string>",
		"<key>RunAtLoad</key>\n\t<true/>",
		"<key>SuccessfulExit</key>\n\t\t<false/>",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("the login item's plist has no %q", want)
		}
	}
	if job.Label+".plist" != schedule.LoginItemPlist || !job.RunAtLoad || !job.KeepAlive {
		t.Errorf("the agent's job is %+v", job)
	}
}

// The app tries once per build, and again at each start while macOS waits
// for approval.
func TestLoginItemOncePerBuild(t *testing.T) {
	path := filepath.Join(t.TempDir(), "Homelab Wizard", "login-item.json")
	state, tries := itemNotRegistered, 0
	li := loginItem{jobs: &fakeJobs{loaded: true},
		state:    func() int { return state },
		set:      func(on bool) error { tries++; return nil },
		fallback: func() error { return nil }}
	if got := li.once(path, "1.0"); !strings.Contains(got, "not enabled") || tries == 0 {
		t.Fatalf("the first try: %q after %d calls", got, tries)
	}
	var note loginItemNote
	data, err := os.ReadFile(path)
	if err != nil || json.Unmarshal(data, &note) != nil || note.Version != "1.0" || note.Result == "" {
		t.Fatalf("the note: %s, %v", data, err)
	}
	tries = 0
	if got := li.once(path, "1.0"); got != "" || tries != 0 {
		t.Errorf("the same build tried again: %q", got)
	}
	state = itemRequiresApproval
	if got := li.once(path, "1.0"); !strings.Contains(got, "approval") {
		t.Errorf("waiting for approval is not tried again: %q", got)
	}
	state, li.jobs = itemNotRegistered, &fakeJobs{loaded: true}
	if got := li.once(path, "1.1"); got == "" {
		t.Error("a new build is not tried")
	}
	if loginItemNotePath() == "" && os.Getenv("HOME") != "" {
		t.Error("no place for the note")
	}
	if bundledLoginItem() {
		t.Error("a test binary carries the login item")
	}
}

package docker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"testing"
	"time"
)

func TestBriefLimitIsAMomentNotAnHour(t *testing.T) {
	for _, c := range []struct {
		out  string
		want bool
	}{
		{" syncthing Error toomanyrequests: retry-after: 751.197µs, allowed: 44000/minute", true},
		{"error pulling image configuration: download failed after attempts=1: toomanyrequests: retry-after: 2s, allowed: 44000/minute", true},
		{"toomanyrequests: retry-after: 2h0m0s", false},
		{"toomanyrequests: You have reached your pull rate limit. You may increase the limit by authenticating", false},
		{"Error response from daemon: manifest unknown", false},
	} {
		if _, got := briefLimit(c.out); got != c.want {
			t.Errorf("briefLimit(%q) = %v, want %v", c.out, got, c.want)
		}
	}
}

// busyRunner says the registry is busy a number of times, then succeeds.
type busyRunner struct {
	FakeRunner
	busy  int
	tries int
}

func (b *busyRunner) Stream(context.Context, string, string, ...string) error {
	b.tries++
	if b.tries <= b.busy {
		return ErrRegistryBusy
	}
	return nil
}

func TestComposeTriesAgainWhenTheRegistryIsBusy(t *testing.T) {
	old := registryBusyWaits
	registryBusyWaits = []time.Duration{time.Millisecond, time.Millisecond, time.Millisecond}
	defer func() { registryBusyWaits = old }()
	p := Project{Name: "homelab_cloud", Dir: t.TempDir(), ComposeFile: "compose.yaml"}

	r := &busyRunner{busy: 2}
	if err := (&Client{Runner: r, Bin: "docker"}).Compose(context.Background(), p, nil, "up", "--detach", "syncthing"); err != nil || r.tries != 3 {
		t.Errorf("busy twice: %v after %d tries", err, r.tries)
	}
	// Still busy after the three waits: it says so.
	r = &busyRunner{busy: 10}
	if err := (&Client{Runner: r, Bin: "docker"}).Compose(context.Background(), p, nil, "up"); !errors.Is(err, ErrRegistryBusy) || r.tries != 4 {
		t.Errorf("always busy: %v after %d tries", err, r.tries)
	}
	// Any other failure is not tried again.
	f := &FakeRunner{StreamErr: errors.New("manifest unknown")}
	if err := (&Client{Runner: f, Bin: "docker"}).Compose(context.Background(), p, nil, "up"); err == nil || len(f.Streamed) != 1 {
		t.Errorf("another failure: %v after %d tries", err, len(f.Streamed))
	}
}

// TestStreamKnowsABusyRegistry runs this test binary as a docker that
// prints lscr.io's rate limit, as Compose does, and fails.
func TestStreamKnowsABusyRegistry(t *testing.T) {
	if os.Getenv("HOMELAB_FAKE_BUSY") == "1" {
		fmt.Fprintln(os.Stderr, " syncthing Error toomanyrequests: retry-after: 751.197µs, allowed: 44000/minute")
		os.Exit(1)
	}
	t.Setenv("HOMELAB_FAKE_BUSY", "1")
	err := ExecRunner{Stdout: io.Discard, Stderr: io.Discard}.Stream(context.Background(), t.TempDir(), os.Args[0], "-test.run=TestStreamKnowsABusyRegistry")
	if !errors.Is(err, ErrRegistryBusy) {
		t.Errorf("got %v, want ErrRegistryBusy", err)
	}
}

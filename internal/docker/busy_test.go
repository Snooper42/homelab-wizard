package docker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
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
	old := RegistryBusyWaits
	RegistryBusyWaits = []time.Duration{time.Millisecond, time.Millisecond, time.Millisecond}
	defer func() { RegistryBusyWaits = old }()
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

// The limit is a count per minute shared with everyone behind the same
// address (CI runners, a household behind its provider's shared address):
// the nightly runs of Nov 4 and 5, 2026 hit it on all four tries within
// 50 seconds. The tries span more than two of its minutes.
func TestBusyRegistryTriesOutlastItsMinute(t *testing.T) {
	var total time.Duration
	for _, d := range RegistryBusyWaits {
		total += d
	}
	if total < 2*time.Minute {
		t.Errorf("the waits add up to %v: a registry busy for its whole minute is still busy at the last try", total)
	}
}

// docker run and docker pull, outside Compose, say a busy registry as
// Stream does, so the one who asked can wait and try again.
func TestOutputAndPipeKnowABusyRegistry(t *testing.T) {
	if os.Getenv("HOMELAB_FAKE_BUSY") == "1" {
		fmt.Fprintln(os.Stderr, "docker: error pulling image configuration: download failed after attempts=1: toomanyrequests: retry-after: 205.338µs, allowed: 44000/minute")
		os.Exit(125)
	}
	t.Setenv("HOMELAB_FAKE_BUSY", "1")
	r := ExecRunner{}
	_, err := r.Output(context.Background(), os.Args[0], "-test.run=TestOutputAndPipeKnowABusyRegistry")
	if !errors.Is(err, ErrRegistryBusy) || !strings.Contains(err.Error(), "toomanyrequests") {
		t.Errorf("Output: %v, want ErrRegistryBusy and docker's words", err)
	}
	if err := r.Pipe(context.Background(), io.Discard, os.Args[0], "-test.run=TestOutputAndPipeKnowABusyRegistry"); !errors.Is(err, ErrRegistryBusy) {
		t.Errorf("Pipe: %v, want ErrRegistryBusy", err)
	}
}

// busyPuller says the registry is busy for its first pulls of an image.
type busyPuller struct {
	FakeRunner
	busy  int
	pulls int
}

func (b *busyPuller) Output(ctx context.Context, name string, args ...string) ([]byte, error) {
	if len(args) > 0 && args[0] == "pull" {
		b.pulls++
		if b.pulls <= b.busy {
			return nil, fmt.Errorf("docker pull: toomanyrequests (%w)", ErrRegistryBusy)
		}
		b.Images[args[len(args)-1]] = "sha256:new"
		return nil, nil
	}
	return b.FakeRunner.Output(ctx, name, args...)
}

// An image a command runs (Duplicati's restore, a database's dump helper)
// is pulled first when it is not here, waiting out a busy registry; one
// already here is not pulled at all.
func TestEnsureImageWaitsOutABusyRegistry(t *testing.T) {
	old := RegistryBusyWaits
	RegistryBusyWaits = []time.Duration{time.Millisecond, time.Millisecond, time.Millisecond}
	defer func() { RegistryBusyWaits = old }()
	ctx := context.Background()

	r := &busyPuller{FakeRunner: FakeRunner{Images: map[string]string{"here:1": "sha256:here"}}, busy: 2}
	c := &Client{Runner: r, Bin: "docker"}
	if err := c.EnsureImage(ctx, "here:1"); err != nil || r.pulls != 0 {
		t.Errorf("an image already here: %v after %d pulls", err, r.pulls)
	}
	if err := c.EnsureImage(ctx, "lscr.io/linuxserver/duplicati:latest"); err != nil || r.pulls != 3 {
		t.Errorf("busy twice: %v after %d pulls", err, r.pulls)
	}
	r = &busyPuller{FakeRunner: FakeRunner{Images: map[string]string{}}, busy: 10}
	c = &Client{Runner: r, Bin: "docker"}
	if err := c.Pull(ctx, "ghcr.io/immich-app/immich-server:v3"); !errors.Is(err, ErrRegistryBusy) || r.pulls != 4 {
		t.Errorf("always busy: %v after %d pulls", err, r.pulls)
	}
	// Any other failure is not tried again.
	f := &FakeRunner{PullErr: map[string]error{"gone:1": errors.New("manifest unknown")}}
	if err := (&Client{Runner: f, Bin: "docker"}).Pull(ctx, "gone:1"); err == nil || strings.Count(strings.Join(f.Calls, "\n"), "pull") != 1 {
		t.Errorf("another failure: %v, calls %v", err, f.Calls)
	}
}

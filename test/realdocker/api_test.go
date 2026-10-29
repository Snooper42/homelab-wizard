//go:build realdocker

package realdocker

import (
	"context"
	"slices"
	"testing"
	"time"

	hdocker "github.com/Snooper42/homelab-wizard/internal/docker"
)

// apiReadsAsTheCLI reads the homelab once through the engine's API and once
// through the docker command, on the real engine: the same containers in
// the same states, the same engine, the same apps using it, and an event
// for a container restarted while the API follows them (0.15: the API is
// on unless DOCKER_API turns it off, so every other step of this run uses
// it too).
func (l *lab) apiReadsAsTheCLI(t *testing.T) {
	bin, err := hdocker.FindCLI()
	if err != nil {
		t.Fatal(err)
	}
	cli := &hdocker.Client{Runner: hdocker.ExecRunner{}, Bin: bin}
	api := hdocker.WithAPI(&hdocker.Client{Runner: hdocker.ExecRunner{}, Bin: bin})
	if api.API == nil {
		t.Fatalf("no engine socket found where the CLI would look (%s)", api.Reads())
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	viaCLI, err := cli.Containers(ctx)
	if err != nil {
		t.Fatal(err)
	}
	viaAPI, err := api.Containers(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if f := hdocker.LastFallback(); !f.When.IsZero() {
		t.Fatalf("the API fell back to the CLI: %+v", f)
	}
	type seen struct {
		service, health string
		running         bool
	}
	read := func(cs []hdocker.Container) map[string]seen {
		m := map[string]seen{}
		for _, c := range cs {
			m[c.Name] = seen{c.Service(), c.Health, c.Running}
		}
		return m
	}
	a, c := read(viaAPI), read(viaCLI)
	if len(a) == 0 || len(a) != len(c) {
		t.Fatalf("%d containers through the API, %d through the CLI", len(a), len(c))
	}
	for name, s := range c {
		if a[name] != s {
			t.Errorf("%s: %+v through the API, %+v through the CLI", name, a[name], s)
		}
	}

	ia, err := api.Info(ctx)
	if err != nil {
		t.Fatal(err)
	}
	ic, _ := cli.Info(ctx)
	if ia.ServerVersion == "" || ia.ServerVersion != ic.ServerVersion || ia.NCPU != ic.NCPU {
		t.Errorf("info: %+v through the API, %+v through the CLI", ia, ic)
	}

	sa, err := api.Stats(ctx)
	if err != nil {
		t.Fatal(err)
	}
	sc, _ := cli.Stats(ctx)
	names := func(ss []hdocker.Stat) []string {
		var n []string
		for _, s := range ss {
			n = append(n, s.Name)
		}
		slices.Sort(n)
		return n
	}
	if !slices.Equal(names(sa), names(sc)) {
		t.Errorf("stats for %v through the API, %v through the CLI", names(sa), names(sc))
	}

	// An event, through the API, for a container restarted now.
	var target string
	for name, s := range c {
		if s.running && s.service == "ntfy" {
			target = name
		}
	}
	if target == "" {
		t.Log("no ntfy running: the events are left to the rest of the run")
		return
	}
	evCtx, stop := context.WithTimeout(ctx, 60*time.Second)
	defer stop()
	got := make(chan string, 8)
	go api.Events(evCtx, func(e hdocker.Event) { got <- e.Action + " " + e.Service() })
	time.Sleep(time.Second)
	docker(t, "restart", target)
	for {
		select {
		case e := <-got:
			if e == "start ntfy" || e == "restart ntfy" {
				return
			}
		case <-evCtx.Done():
			t.Fatal("no start event for ntfy through the API within a minute")
		}
	}
}

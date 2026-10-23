package engine

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
)

func event(action, service string) string {
	return `{"Type":"container","Action":"` + action + `","Actor":{"ID":"x","Attributes":{"com.docker.compose.service":"` + service + `","name":"homelab-` + service + `-1"}}}`
}

func TestWatchGathersABurstAndFollowsTheRuntime(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var mu sync.Mutex
	var got []Change
	calls := 0
	w := Watcher{
		Quiet: 20 * time.Millisecond, Retry: 10 * time.Millisecond,
		Connect: func(context.Context) (*docker.Client, error) {
			mu.Lock()
			defer mu.Unlock()
			calls++
			switch calls {
			case 1: // a burst, then the runtime stops
				f := &docker.FakeRunner{Events: []string{event("die", "memos"), event("start", "memos"), event("health_status: healthy", "ntfy"), "not json"}, EventsErr: errors.New("docker events: EOF")}
				return &docker.Client{Runner: f, Bin: "docker"}, nil
			case 2, 3: // gone for a while
				return nil, errors.New("Cannot connect to the Docker daemon")
			default: // back, quiet
				return &docker.Client{Runner: &docker.FakeRunner{EventsErr: context.Canceled}, Bin: "docker"}, nil
			}
		},
	}
	done := make(chan struct{})
	go func() {
		w.Run(ctx, func(c Change) {
			mu.Lock()
			got = append(got, c)
			n := len(got)
			mu.Unlock()
			if n == 3 {
				cancel()
			}
		})
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("no changes reported")
	}
	want := []Change{{Apps: []string{"memos", "ntfy"}}, {Runtime: true}, {Runtime: true}}
	if !reflect.DeepEqual(got[:3], want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestEventService(t *testing.T) {
	var e docker.Event
	e.Actor.Attributes = map[string]string{"name": "watchtower"}
	if e.Service() != "watchtower" {
		t.Errorf("no compose label: %q", e.Service())
	}
}

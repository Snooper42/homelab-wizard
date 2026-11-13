package companion

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/engine"
)

// Send to my phone (the owner, Nov 12: pick a phone each time): what the
// computer sends is one of the app's own links, and only to a phone that
// may see it; a wall screen never gets one.
func TestSendLinks(t *testing.T) {
	for _, ok := range []string{"homelab://app/radarr", "homelab://status", "homelab://backups", "homelab://finances", "homelab://finances/recurring"} {
		if !OpenLink(ok) {
			t.Errorf("%s refused", ok)
		}
	}
	for _, bad := range []string{"", "homelab://tidy/inbox", "https://example.com", "javascript:alert(1)", "homelab://settings", "homelab://app/../x", "homelab://app/Radarr", "homelab://app/radarr?do=stop", "homelab://finances/a/b", "homelab://app/" + strings.Repeat("a", 80)} {
		if OpenLink(bad) {
			t.Errorf("%q let through", bad)
		}
	}
	owner := Device{ID: "a", Name: "Sam's iPhone", CanChange: true, Finances: FinancesEdit}
	look := Device{ID: "b", Name: "The iPad", Finances: FinancesView}
	wall := Device{ID: "c", Name: "Kitchen", Kiosk: true, Finances: FinancesCard}
	member := Device{ID: "d", Name: "Anna's iPhone", Person: "anna"}
	uses := func(id string) bool { return id == "immich" }
	for _, c := range []struct {
		d    Device
		link string
		want bool
	}{
		{owner, "homelab://app/radarr", true}, {owner, "homelab://finances/recurring", true},
		{look, "homelab://finances", true}, {look, "homelab://status", true},
		{wall, "homelab://status", false}, {wall, "homelab://finances", false},
		{Device{ID: "e", Finances: FinancesCard}, "homelab://finances", false},
		{Device{ID: "f"}, "homelab://finances", false},
		{member, "homelab://app/immich", true}, {member, "homelab://app/radarr", false},
		{member, "homelab://status", true}, {member, "homelab://backups", false}, {member, "homelab://finances", false},
	} {
		if got := MayOpen(c.d, c.link, uses); got != c.want {
			t.Errorf("%s, %s: %v", c.d.Name, c.link, got)
		}
	}
}

// A send is a small file in the homelab folder, picked up by the companion
// (another process) and passed on once; one left too long is dropped.
func TestSentIsPassedOnOnce(t *testing.T) {
	root := t.TempDir()
	if err := Send(root, Sent{Device: "a", Link: "homelab://app/radarr", Title: "Radarr"}); err != nil {
		t.Fatal(err)
	}
	if err := Send(root, Sent{Device: "a", Link: "https://example.com"}); err == nil {
		t.Error("a link that isn't the app's own was kept")
	}
	if err := Send(root, Sent{Link: "homelab://status"}); err == nil {
		t.Error("a send to no phone was kept")
	}
	old := filepath.Join(SentDir(root), "1-old.json")
	if err := os.WriteFile(old, []byte(`{"device":"a","link":"homelab://status","at":"2026-01-01T00:00:00Z"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var got []Sent
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go FollowSent(ctx, root, 10*time.Millisecond, func(s Sent) { mu.Lock(); got = append(got, s); mu.Unlock() })
	for deadline := time.Now().Add(3 * time.Second); ; time.Sleep(10 * time.Millisecond) {
		mu.Lock()
		n := len(got)
		mu.Unlock()
		left, _ := os.ReadDir(SentDir(root))
		if n > 0 && len(left) == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("passed on %d, %d left", n, len(left))
		}
	}
	time.Sleep(50 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	if len(got) != 1 || got[0].Link != "homelab://app/radarr" || got[0].Title != "Radarr" || got[0].Device != "a" {
		t.Errorf("passed on: %+v", got)
	}
}

// What is sent to one phone reaches only that phone's stream, and says
// nothing of which phone it was for.
func TestASendReachesOnlyItsPhone(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "phones.json"))
	tokens := map[string]string{}
	ids := map[string]string{}
	for _, name := range []string{"Sam's iPhone", "The iPad"} {
		code, _ := store.NewPairing(name, true, "")
		d, token, err := store.Pair(code, "")
		if err != nil {
			t.Fatal(err)
		}
		tokens[name], ids[name] = token, d.ID
	}
	hub := &engine.Hub{}
	srv := httptest.NewServer((&Server{Store: store, Changes: hub, Files: fstest.MapFS{}}).Handler())
	// Closed after the streams below are (cleanups run last first): Close waits for every request to end.
	t.Cleanup(srv.Close)
	follow := func(name string) *bufio.Scanner {
		req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/events", nil)
		req.Header.Set("Authorization", "Bearer "+tokens[name])
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { resp.Body.Close() })
		return bufio.NewScanner(resp.Body)
	}
	sam, ipad := follow("Sam's iPhone"), follow("The iPad")
	for hub.Subscribers() < 2 {
		time.Sleep(10 * time.Millisecond)
	}
	// The hub drops a change for a stream not ready for it, so each is sent
	// again until it is read; the iPad's first line must be the other change.
	lines := func(sc *bufio.Scanner) <-chan string {
		ch := make(chan string, 8)
		go func() {
			for sc.Scan() {
				if data, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
					ch <- data
				}
			}
		}()
		return ch
	}
	samLines, ipadLines := lines(sam), lines(ipad)
	open := engine.Change{Open: &engine.Open{Device: ids["Sam's iPhone"], Link: "homelab://app/radarr", Title: "Radarr"}}
	wait := func(ch <-chan string, again engine.Change) string {
		deadline := time.After(3 * time.Second)
		for {
			hub.Publish(again)
			select {
			case got := <-ch:
				return got
			case <-time.After(20 * time.Millisecond):
			case <-deadline:
				return ""
			}
		}
	}
	if got := wait(samLines, open); got != `{"open":{"link":"homelab://app/radarr","title":"Radarr"}}` {
		t.Errorf("Sam's iPhone: %s", got)
	}
	if got := wait(ipadLines, engine.Change{Apps: []string{"immich"}}); got != `{"apps":["immich"]}` {
		t.Errorf("the iPad got another phone's send: %s", got)
	}
}

// Open on the computer: a phone's ask waits for the desktop app (another
// process), the last one asked only, and goes stale as a send does.
func TestAskedIsTakenOnce(t *testing.T) {
	root := t.TempDir()
	if err := Ask(root, Asked{Link: "https://example.com"}); err == nil {
		t.Error("a link that isn't the app's own was kept")
	}
	if err := Ask(root, Asked{Link: "homelab://status", From: "Sam's iPhone"}); err != nil {
		t.Fatal(err)
	}
	if err := Ask(root, Asked{Link: "homelab://backups", From: "Sam's iPhone"}); err != nil {
		t.Fatal(err)
	}
	if got, ok := TakeAsked(root, time.Now().Add(3*time.Minute)); ok {
		t.Errorf("a stale ask was taken: %+v", got)
	}
	if err := Ask(root, Asked{Link: "homelab://backups", From: "Sam's iPhone"}); err != nil {
		t.Fatal(err)
	}
	got, ok := TakeAsked(root, time.Now())
	if !ok || got.Link != "homelab://backups" || got.From != "Sam's iPhone" {
		t.Errorf("taken: %+v %v", got, ok)
	}
	if _, ok := TakeAsked(root, time.Now()); ok {
		t.Error("taken twice")
	}
}

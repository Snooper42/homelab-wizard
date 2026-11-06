package turn

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// someone puts another process's ticket in the queue, asked at.
func someone(t *testing.T, root string, p int, what string, at time.Time) string {
	t.Helper()
	if err := os.MkdirAll(Dir(root), 0o700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(Dir(root), fmt.Sprintf("%020d-%d.json", at.UnixNano(), p))
	data, _ := json.Marshal(Ticket{PID: p, What: what, At: at, Host: hostname()})
	if err := os.WriteFile(file, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return file
}

func fakes(t *testing.T, live map[int]bool) {
	was, wasAlive, wasPoll := pid, alive, poll
	pid = func() int { return 100 }
	alive = func(p int) bool { return p == 100 || live[p] }
	poll = 5 * time.Millisecond
	t.Setenv(Env, "")
	t.Cleanup(func() { pid, alive, poll = was, wasAlive, wasPoll })
}

// Nothing ahead: the job goes at once, its children know they have its
// turn, and its ticket goes with it.
func TestTakeWithNothingAhead(t *testing.T) {
	fakes(t, nil)
	root := t.TempDir()
	release, err := Take(context.Background(), root, "a backup", nil)
	if err != nil {
		t.Fatal(err)
	}
	held := os.Getenv(Env)
	if held == "" || len(Queue(root)) != 1 || Queue(root)[0].What != "a backup" {
		t.Fatalf("held %q, queue %+v", held, Queue(root))
	}
	if fi, err := os.Stat(held); err != nil || (fi.Mode().Perm() != 0o600 && os.PathSeparator == '/') {
		t.Errorf("the ticket: %v %v", fi, err)
	}
	// A child of this job (homelab backup from homelab update) has its turn.
	again, err := Take(context.Background(), root, "a child", nil)
	if err != nil || len(Queue(root)) != 1 {
		t.Fatalf("a child queued behind its own job: %v %+v", err, Queue(root))
	}
	again()
	release()
	if os.Getenv(Env) != "" || len(Queue(root)) != 0 {
		t.Errorf("after release: %q %+v", os.Getenv(Env), Queue(root))
	}
}

// A job behind another waits, says for what, and goes once that one ends.
func TestTakeWaitsItsTurn(t *testing.T) {
	fakes(t, map[int]bool{200: true})
	root := t.TempDir()
	other := someone(t, root, 200, "the nightly update", time.Now().Add(-time.Minute))
	var said []string
	done := make(chan error, 1)
	go func() {
		release, err := Take(context.Background(), root, "restarting Immich", func(a Ticket) { said = append(said, a.What) })
		if err == nil {
			release()
		}
		done <- err
	}()
	select {
	case err := <-done:
		t.Fatalf("went before the job ahead ended: %v", err)
	case <-time.After(60 * time.Millisecond):
	}
	if q := Queue(root); len(q) != 2 || q[0].What != "the nightly update" || q[1].What != "restarting Immich" {
		t.Fatalf("the queue: %+v", q)
	}
	_ = os.Remove(other)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if len(said) != 1 || said[0] != "the nightly update" {
		t.Errorf("said it waited for %v", said)
	}
}

// A ticket left by a process that died, or kept past MaxAge (its process
// ID used again), is cleared and holds no one up.
func TestTicketsLeftBehindHoldNoOneUp(t *testing.T) {
	fakes(t, map[int]bool{300: true})
	root := t.TempDir()
	dead := someone(t, root, 200, "a crash", time.Now().Add(-time.Minute))
	// One that came with the folder from another machine (homelab move).
	away := filepath.Join(Dir(root), fmt.Sprintf("%020d-%d.json", time.Now().Add(-time.Minute).UnixNano(), 300))
	data, _ := json.Marshal(Ticket{PID: 300, What: "a job elsewhere", At: time.Now().Add(-time.Minute), Host: "another-machine"})
	if err := os.WriteFile(away, data, 0o600); err != nil {
		t.Fatal(err)
	}
	old := someone(t, root, 300, "long ago", time.Now().Add(-MaxAge-time.Hour))
	if err := os.WriteFile(filepath.Join(Dir(root), "0-1.json"), []byte("not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	release, err := Take(context.Background(), root, "a backup", nil)
	if err != nil {
		t.Fatal(err)
	}
	release()
	for _, f := range []string{dead, old, away} {
		if _, err := os.Stat(f); !os.IsNotExist(err) {
			t.Errorf("%s was kept: %v", filepath.Base(f), err)
		}
	}
}

// A ticket dated ahead of now (a clock set back, or a move file someone
// else made) never grows older than MaxAge, so it would stand first for
// good: it is taken for one left behind, whoever holds it.
func TestATicketFromTheFutureHoldsNoOneUp(t *testing.T) {
	fakes(t, map[int]bool{1: true})
	root := t.TempDir()
	ahead := filepath.Join(Dir(root), fmt.Sprintf("%020d-%d.json", 0, 1))
	if err := os.MkdirAll(Dir(root), 0o700); err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(Ticket{PID: 1, What: "a job", At: time.Now().Add(24 * time.Hour), Host: hostname()})
	if err := os.WriteFile(ahead, data, 0o600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	release, err := Take(ctx, root, "a backup", nil)
	if err != nil {
		t.Fatalf("waited behind a ticket from the future: %v", err)
	}
	release()
	if _, err := os.Stat(ahead); !os.IsNotExist(err) {
		t.Errorf("the ticket from the future was kept: %v", err)
	}
	// A clock a little ahead on the machine that made it is still a job.
	near := someone(t, root, 1, "a job", time.Now().Add(time.Minute))
	if q := Queue(root); len(q) != 1 {
		t.Errorf("a ticket a minute ahead was cleared: %v", q)
	}
	_ = os.Remove(near)
}

// A job that gives up while it waits (the app quit, Ctrl-C) leaves the queue.
func TestTakeGivesUpItsPlace(t *testing.T) {
	fakes(t, map[int]bool{200: true})
	root := t.TempDir()
	someone(t, root, 200, "the nightly backup", time.Now().Add(-time.Minute))
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Millisecond)
	defer cancel()
	if _, err := Take(ctx, root, "a restart", nil); err == nil {
		t.Fatal("went though the job ahead runs")
	}
	if q := Queue(root); len(q) != 1 {
		t.Errorf("its ticket stayed: %+v", q)
	}
}

// A ticket name that says the child has a turn it no longer has (the job
// ended) does not let it skip the queue.
func TestAnEndedTurnIsNotInherited(t *testing.T) {
	fakes(t, map[int]bool{200: true})
	root := t.TempDir()
	t.Setenv(Env, filepath.Join(Dir(root), "gone.json"))
	someone(t, root, 200, "the nightly update", time.Now().Add(-time.Minute))
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Millisecond)
	defer cancel()
	if _, err := Take(ctx, root, "a restart", nil); err == nil {
		t.Error("skipped the queue with an ended job's turn")
	}
}

// Where the queue cannot be kept, Take says so.
func TestTakeFailsPlainly(t *testing.T) {
	fakes(t, nil)
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "data"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(Dir(root), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Take(context.Background(), root, "x", nil); err == nil {
		t.Error("took a turn with no queue")
	}
	if q := Queue(t.TempDir()); q != nil {
		t.Errorf("a queue where there is none: %+v", q)
	}
}

// This process runs; one that never was does not.
func TestProcessAlive(t *testing.T) {
	if !processAlive(os.Getpid()) {
		t.Error("this process is not running")
	}
	if processAlive(1 << 30) {
		t.Error("a process that never was is running")
	}
}

package lockedfile

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// A save outlasts a reader that opens the file again and again (the agent
// and the app read .env and the records all the time): on Windows each
// rename over the open file fails for that moment, and Write tries again
// in the gaps. Off Windows a rename never waits for a reader.
func TestWriteOutlastsAReaderOpeningItAgainAndAgain(t *testing.T) {
	path := filepath.Join(t.TempDir(), "record.json")
	if err := Write(path, []byte(`{"n":0}`), 0o600); err != nil {
		t.Fatal(err)
	}
	var stop atomic.Bool
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for !stop.Load() {
				_, _ = os.ReadFile(path)
			}
		}()
	}
	defer func() { stop.Store(true); wg.Wait() }()
	for i := range 300 {
		if err := Write(path, []byte(`{"n":1}`), 0o600); err != nil {
			t.Fatalf("save %d: %v", i, err)
		}
	}
}

// A reader reading while another process saves again and again gets the
// old record or the new one, every time: on Windows an open that meets
// the rename is tried again rather than read as no record at all.
func TestReadNeverMissesARecordBeingSaved(t *testing.T) {
	path := filepath.Join(t.TempDir(), "record.json")
	if err := Write(path, []byte(`{"n":0}`), 0o600); err != nil {
		t.Fatal(err)
	}
	var stop atomic.Bool
	var wg sync.WaitGroup
	failed := make(chan string, 1)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for !stop.Load() {
				data, err := Read(path)
				if err != nil || (string(data) != `{"n":0}` && string(data) != `{"n":1}`) {
					select {
					case failed <- fmt.Sprintf("%q %v", data, err):
					default:
					}
					return
				}
			}
		}()
	}
	for i := range 300 {
		if err := Write(path, []byte(`{"n":`+strconv.Itoa(i%2)+`}`), 0o600); err != nil {
			t.Fatalf("save %d: %v", i, err)
		}
	}
	stop.Store(true)
	wg.Wait()
	select {
	case got := <-failed:
		t.Errorf("a reader missed the record: %s", got)
	default:
	}
}

// Off Windows a failed read is final: a file that can't be read now won't
// be in a moment either.
func TestReadDoesNotWaitOnAMissingRecord(t *testing.T) {
	start := time.Now()
	if _, err := Read(filepath.Join(t.TempDir(), "none.json")); !os.IsNotExist(err) {
		t.Fatalf("err = %v", err)
	}
	if time.Since(start) > RenameWait/2 {
		t.Errorf("a missing record took %v to report", time.Since(start))
	}
}

// On Windows an open that meets a rename is tried again until it reads;
// one still failing after RenameWait is reported, and any other failure
// is reported at once.
func TestReadTriesAgainOnlyWhileTheFileIsBusy(t *testing.T) {
	was, wasWait, wasRead := onWindows, RenameWait, readFile
	t.Cleanup(func() { onWindows, RenameWait, readFile = was, wasWait, wasRead })
	onWindows, RenameWait = true, 50*time.Millisecond
	inUse := &os.PathError{Op: "open", Path: "record.json", Err: errSharingViolation}
	denied := &os.PathError{Op: "open", Path: "record.json", Err: os.ErrPermission}
	pending := &os.PathError{Op: "open", Path: "record.json", Err: errDeletePending}
	always := func(err error) func(int) error { return func(int) error { return err } }
	for _, tc := range []struct {
		name  string
		fail  func(read int) error // the error the read-th read meets, or nil
		reads int                  // 0: as many as the wait allows
		ok    bool
	}{
		{"in use, then free", func(read int) error {
			return map[int]error{1: inUse, 2: denied}[read]
		}, 3, true},
		// The old file, replaced while another reader still has it open.
		{"delete pending, then free", func(read int) error {
			return map[int]error{1: pending, 2: pending}[read]
		}, 3, true},
		{"in use throughout", always(inUse), 0, false},
		// Looked for once more, in case a save finished in between.
		{"missing", always(os.ErrNotExist), 2, false},
		{"missing for an instant", func(read int) error {
			return map[int]error{1: os.ErrNotExist}[read]
		}, 2, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reads := 0
			readFile = func(string) ([]byte, error) {
				reads++
				if err := tc.fail(reads); err != nil {
					return nil, err
				}
				return []byte(`{"n":1}`), nil
			}
			data, err := Read("record.json")
			if (err == nil) != tc.ok || (tc.ok && string(data) != `{"n":1}`) {
				t.Fatalf("Read = %q, %v", data, err)
			}
			if tc.reads > 0 && reads != tc.reads {
				t.Errorf("%d reads, want %d", reads, tc.reads)
			}
		})
	}
}

// On Windows a record that reads as missing while a save of it is under
// way (its new file beside it) is tried again until the save lands; an
// old new file a save that died left behind does not count.
func TestReadWaitsForASaveUnderWay(t *testing.T) {
	was, wasWait, wasRead := onWindows, RenameWait, readFile
	t.Cleanup(func() { onWindows, RenameWait, readFile = was, wasWait, wasRead })
	onWindows, RenameWait = true, time.Second
	dir := t.TempDir()
	path := filepath.Join(dir, "agent.json")
	tmp := path + ".tmp123"
	if err := os.WriteFile(tmp, []byte(`{"n":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	reads := 0
	readFile = func(string) ([]byte, error) {
		reads++
		if reads <= 5 {
			return nil, os.ErrNotExist
		}
		return []byte(`{"n":1}`), nil
	}
	if data, err := Read(path); err != nil || string(data) != `{"n":1}` {
		t.Fatalf("Read = %q, %v after %d reads", data, err, reads)
	}

	old := time.Now().Add(-time.Hour)
	if err := os.Chtimes(tmp, old, old); err != nil {
		t.Fatal(err)
	}
	reads = 0
	readFile = func(string) ([]byte, error) { reads++; return nil, os.ErrNotExist }
	start := time.Now()
	if _, err := Read(path); !os.IsNotExist(err) {
		t.Fatalf("err = %v", err)
	}
	if reads != 2 || time.Since(start) > RenameWait/2 {
		t.Errorf("a missing record with a stale save beside it took %d reads and %v", reads, time.Since(start))
	}
}

// A folder that can't be listed says no save is under way, so a missing
// record there is reported rather than waited on.
func TestBeingSavedInAFolderThatIsNotThere(t *testing.T) {
	if beingSaved(filepath.Join(t.TempDir(), "gone", "agent.json")) {
		t.Error("a missing folder reads as a save under way")
	}
}

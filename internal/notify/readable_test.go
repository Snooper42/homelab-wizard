package notify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// A Duplicati report reaches ntfy form-encoded (message=Duplicati%20Backup
// …), and the app showed it so (Nov 6, the owner's Status). It reads as a
// title and the warnings, decoded; other alerts are left as they are.
func TestADuplicatiReportReadsAsSentences(t *testing.T) {
	report := strings.Join([]string{
		"Duplicati Backup report for Homelab AppData (849afa004, 849af06dcad0)",
		"",
		"DeletedFiles: 13",
		"DeletedFolders: 0",
		"EndTime: 11/6/2026 9:27:29 AM (1762439249)",
		"ParsedResult: Warning",
		"Messages: [",
		"    2026-11-06 09:26:11 -05 - [Information-Duplicati.Library.Main.Controller-StartingOperation]: The operation Backup has started,",
		"    2026-11-06 09:26:16 -05 - [Information-Duplicati.Library.Main.BasicResults-BackendEvent]: Backend event: List - Started:  (),",
		"]",
		"Warnings: [",
		"    2026-11-06 09:27:01 -05 - [Warning-Duplicati.Library.Main.Operation.Backup.FileEnumerationProcess-FileAccessError]: Error reported while accessing file: /source/navidrome/cache/x.tmp,",
		"]",
		"Errors: []",
	}, "\n")
	e := Readable(Event{Topic: "duplicati-alerts", Message: "message=" + url.QueryEscape(report)})
	if e.Title != "The backup of Homelab AppData finished with warnings" {
		t.Errorf("title %q", e.Title)
	}
	if e.Message != "Error reported while accessing file: /source/navidrome/cache/x.tmp" {
		t.Errorf("message %q", e.Message)
	}

	failed := strings.Replace(report, "ParsedResult: Warning", "ParsedResult: Error", 1)
	failed = strings.Replace(failed, "Errors: []", "Errors: [\n    2026-11-06 09:27:20 -05 - [Error-Duplicati.Library.Main.Operation.BackupHandler-FatalError]: Fatal error,\n    2026-11-06 09:27:21 -05 - [Error-Duplicati.Library.Main.Controller-FailedOperation]: The operation Backup has failed,\n]", 1)
	e = Readable(Event{Message: "message=" + url.QueryEscape(failed)})
	if e.Title != "The backup of Homelab AppData failed" || !strings.Contains(e.Message, "Fatal error") || strings.Count(e.Message, "\n") != 2 {
		t.Errorf("failed: %q / %q", e.Title, e.Message)
	}

	// A title ntfy already has is kept.
	if e := Readable(Event{Title: "Backup failed", Message: "message=" + url.QueryEscape(report)}); e.Title != "Backup failed" {
		t.Errorf("kept title %q", e.Title)
	}
	// Ours, and anything else, are left alone.
	for _, m := range []string{"Updated: Immich, Vaultwarden", "message is a word too", "message=not%ZZ encoded"} {
		if e := Readable(Event{Title: "x", Message: m}); e.Message != m {
			t.Errorf("%q became %q", m, e.Message)
		}
	}
}

// Read from ntfy as Status and the phones read it.
func TestRecentAlertsAreReadable(t *testing.T) {
	report := "Duplicati Backup report for Homelab AppData (849afa004, 849af06dcad0)\n\nParsedResult: Error\nErrors: [\n    2026-11-06 09:27:20 -05 - [Error-Duplicati.Library.Main.Controller-FailedOperation]: The operation Backup has failed,\n]\n"
	line, _ := json.Marshal(map[string]any{"id": "a1", "time": 1762439249, "event": "message", "topic": "duplicati-alerts", "message": "message=" + url.QueryEscape(report)})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(append(line, '\n')) }))
	defer srv.Close()
	events, err := New(srv.URL).Recent(context.Background(), []string{"duplicati-alerts"}, time.Hour)
	if err != nil || len(events) != 1 {
		t.Fatalf("%+v %v", events, err)
	}
	if events[0].Title != "The backup of Homelab AppData failed" || events[0].Message != "The operation Backup has failed" {
		t.Errorf("read as %q / %q", events[0].Title, events[0].Message)
	}
}

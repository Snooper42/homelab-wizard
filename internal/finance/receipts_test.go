package finance

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// Bytes that begin as each kind of receipt does.
var (
	pngBytes  = "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR a receipt"
	jpegBytes = "\xff\xd8\xff\xe0\x00\x10JFIF a receipt"
	webpBytes = "RIFF\x10\x00\x00\x00WEBPVP8 a receipt"
	pdfBytes  = "%PDF-1.4\n a receipt"
)

func dataURL(kind, b string) string {
	return "data:" + kind + ";base64," + base64.StdEncoding.EncodeToString([]byte(b))
}

// A receipt is kept by what is in it, owner-only, and read back as it was;
// the same one sent twice is one file. What is not a picture or a PDF, is
// labelled other than it is, or is too large, is refused.
func TestSaveReadReceipt(t *testing.T) {
	dir := ReceiptsDir(t.TempDir())
	names := map[string]bool{}
	for _, c := range []struct{ kind, bytes, ext string }{
		{"image/png", pngBytes, ".png"}, {"image/jpeg", jpegBytes, ".jpg"}, {"image/webp", webpBytes, ".webp"}, {"application/pdf", pdfBytes, ".pdf"},
	} {
		name, err := SaveReceipt(dir, dataURL(c.kind, c.bytes))
		if err != nil || !strings.HasSuffix(name, c.ext) || !receiptName.MatchString(name) {
			t.Fatalf("%s: %q %v", c.kind, name, err)
		}
		names[name] = true
		back, err := ReadReceipt(dir, name)
		if err != nil || back != dataURL(c.kind, c.bytes) {
			t.Fatalf("%s read back %q %v", c.kind, back, err)
		}
		if runtime.GOOS != "windows" {
			if fi, _ := os.Stat(filepath.Join(dir, name)); fi.Mode().Perm() != 0o600 {
				t.Errorf("%s is %v, not the owner's only", name, fi.Mode().Perm())
			}
		}
		again, err := SaveReceipt(dir, dataURL(c.kind, c.bytes))
		if err != nil || again != name {
			t.Fatalf("%s sent again: %q %v", c.kind, again, err)
		}
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 4 || len(names) != 4 {
		t.Fatalf("%d files for %d receipts", len(entries), len(names))
	}
	for _, bad := range []string{
		"not a data URL",
		"data:image/png," + pngBytes,
		"data:image/png;base64,***",
		dataURL("image/png", "a plain note"),
		dataURL("image/png", pdfBytes),
		dataURL("image/gif", "GIF89a a receipt"),
		dataURL("application/pdf", pdfBytes+strings.Repeat("x", MaxReceipt)),
	} {
		if name, err := SaveReceipt(dir, bad); err == nil {
			t.Errorf("%.40q kept as %s", bad, name)
		}
	}
	for _, name := range []string{"../finance.json", "abc.png", strings.Repeat("0", 32) + ".png"} {
		if _, err := ReadReceipt(dir, name); err == nil {
			t.Errorf("read %q", name)
		}
	}
}

// A receipt no transaction names goes once it has been unused a day; one
// named, one newer, and anything else in the folder stay. Saving the
// ledger prunes beside it, and a transaction's receipt must be a name.
func TestPruneReceipts(t *testing.T) {
	root := t.TempDir()
	dir := ReceiptsDir(root)
	kept, _ := SaveReceipt(dir, dataURL("image/png", pngBytes))
	old, _ := SaveReceipt(dir, dataURL("image/jpeg", jpegBytes))
	fresh, _ := SaveReceipt(dir, dataURL("application/pdf", pdfBytes))
	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("mine"), 0o600); err != nil {
		t.Fatal(err)
	}
	day := time.Now().Add(-25 * time.Hour)
	for _, name := range []string{kept, old, "notes.txt"} {
		if err := os.Chtimes(filepath.Join(dir, name), day, day); err != nil {
			t.Fatal(err)
		}
	}
	p := household()
	l := Ledger{Rev: noFile, Transactions: []Transaction{{Date: "2026-10-30", Account: "chk", Amount: -12.5, Payee: "Hardware store", Receipt: kept}}}
	saved, err := SaveLedger(LedgerPath(root), l, p)
	if err != nil || saved.Transactions[0].Receipt != kept {
		t.Fatalf("saved %+v %v", saved, err)
	}
	left := map[string]bool{}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		left[e.Name()] = true
	}
	if !left[kept] || left[old] || !left[fresh] || !left["notes.txt"] || len(left) != 3 {
		t.Fatalf("left %v", left)
	}
	// A receipt sent again is touched, so one put back is not pruned.
	if err := os.Chtimes(filepath.Join(dir, fresh), day, day); err != nil {
		t.Fatal(err)
	}
	if _, err := SaveReceipt(dir, dataURL("application/pdf", pdfBytes)); err != nil {
		t.Fatal(err)
	}
	if err := pruneReceipts(dir, Ledger{}, time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, fresh)); err != nil {
		t.Fatalf("a receipt sent again was pruned: %v", err)
	}
	if err := pruneReceipts(filepath.Join(root, "none"), Ledger{}, time.Now()); err != nil {
		t.Fatalf("no folder yet: %v", err)
	}
	l = saved
	l.Transactions[0].Receipt = "../finance.json"
	if _, err := SaveLedger(LedgerPath(root), l, p); err == nil || !strings.Contains(err.Error(), "no receipt") {
		t.Fatalf("a receipt that is no name: %v", err)
	}
}

package finance

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// A receipt is a picture or PDF kept with a transaction: made small on the
// device that took it (a picture), sent here as a data URL, and kept in
// data/finance-receipts/ beside the ledger, which the nightly backup copies
// with the ledger. Its file is named for what is in it, so the same receipt
// sent twice is one file, and a transaction names its receipt by that name.
// Nothing here is sent anywhere.

// MaxReceipt is the most a receipt may hold: a page or two of PDF, or a
// photo already shrunk on the device.
const MaxReceipt = 2 << 20

// keepUnused is how long a receipt no transaction names is kept: long enough
// for a form to attach one and save, and for a removed one to be put back.
const keepUnused = 24 * time.Hour

// receiptTypes are the kinds a receipt may be, by what its bytes say it is,
// and the extension each is kept under.
var receiptTypes = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}

// receiptName is the name of a receipt's file: its content's hash and kind.
var receiptName = regexp.MustCompile(`^[0-9a-f]{32}\.(jpg|png|webp|pdf)$`)

// ReceiptsDir is where the receipts are kept, beside the ledger.
func ReceiptsDir(root string) string { return filepath.Join(root, "data", "finance-receipts") }

// receiptsBeside is the receipts folder beside a ledger file.
func receiptsBeside(ledgerPath string) string {
	return filepath.Join(filepath.Dir(ledgerPath), "finance-receipts")
}

// SaveReceipt keeps a receipt sent as a data URL (data:image/jpeg;base64,…)
// and returns its name. A picture must be JPEG, PNG, or WebP, or else a
// PDF, as its own bytes say (not only its label), and at most MaxReceipt.
func SaveReceipt(dir, dataURL string) (string, error) {
	head, body, ok := strings.Cut(dataURL, ",")
	if !ok || !strings.HasPrefix(head, "data:") || !strings.HasSuffix(head, ";base64") {
		return "", errors.New("a receipt is sent as a data URL")
	}
	if base64.StdEncoding.DecodedLen(len(body)) > MaxReceipt+3 {
		return "", fmt.Errorf("a receipt may be at most %d MB", MaxReceipt>>20)
	}
	b, err := base64.StdEncoding.DecodeString(body)
	if err != nil {
		return "", errors.New("a receipt is sent as a data URL")
	}
	if len(b) > MaxReceipt {
		return "", fmt.Errorf("a receipt may be at most %d MB", MaxReceipt>>20)
	}
	kind := http.DetectContentType(b)
	ext, ok := receiptTypes[kind]
	if !ok || strings.TrimSuffix(strings.TrimPrefix(head, "data:"), ";base64") != kind {
		return "", errors.New("a receipt is a JPEG, PNG, or WebP picture, or a PDF")
	}
	sum := sha256.Sum256(b)
	name := hex.EncodeToString(sum[:16]) + "." + ext
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); err == nil {
		// Already kept: touched, so a receipt put back is not pruned as unused.
		now := time.Now()
		return name, os.Chtimes(path, now, now)
	}
	tmp, err := os.CreateTemp(dir, ".receipt-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(b); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	return name, os.Rename(tmp.Name(), path)
}

// ReadReceipt returns a kept receipt as a data URL.
func ReadReceipt(dir, name string) (string, error) {
	if !receiptName.MatchString(name) {
		return "", fmt.Errorf("no receipt %q", name)
	}
	b, err := os.ReadFile(filepath.Join(dir, name))
	if os.IsNotExist(err) {
		return "", fmt.Errorf("the receipt %s is not kept here any more", name)
	}
	if err != nil {
		return "", err
	}
	return "data:" + http.DetectContentType(b) + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}

// pruneReceipts removes the receipts no transaction names that have been
// unused for keepUnused: one removed from its transaction, or attached to a
// form that was never saved. Anything else in the folder is left alone.
func pruneReceipts(dir string, l Ledger, now time.Time) error {
	used := map[string]bool{}
	for _, t := range l.Transactions {
		used[t.Receipt] = true
	}
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !e.Type().IsRegular() || !receiptName.MatchString(e.Name()) || used[e.Name()] {
			continue
		}
		if fi, err := e.Info(); err == nil && now.Sub(fi.ModTime()) > keepUnused {
			if err := os.Remove(filepath.Join(dir, e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

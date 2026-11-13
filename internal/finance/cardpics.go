package finance

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg" // a card's photo may be a JPEG
	_ "image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// A card's picture (the Collection): a photo of one's own, made small on
// the device it was picked on (or, later, the price service's, saved on a
// click), kept on the computer by its content's name and shown from there,
// so no screen ever fetches one. The nightly backup copies the folder.

// CardPicturesDir is where the cards' pictures are kept, beside the plan.
func CardPicturesDir(root string) string { return filepath.Join(root, "data", "finance-cards") }

// MaxCardPicture is the most a picture may weigh, and MaxCardSide the most
// pixels on a side: the screen draws a photo into 800 pixels before it is
// kept, so a real one is far smaller.
const (
	MaxCardPicture = 2 << 20
	MaxCardSide    = 2048
)

// cardTypes are the kinds a picture may be, by what its bytes say it is.
var cardTypes = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

// SaveCardPicture keeps a picture sent as a data URL and returns its name.
func SaveCardPicture(dir, dataURL string) (string, error) {
	head, body, ok := strings.Cut(dataURL, ",")
	if !ok || !strings.HasPrefix(head, "data:") || !strings.HasSuffix(head, ";base64") {
		return "", errors.New("a picture is sent as a data URL")
	}
	if base64.StdEncoding.DecodedLen(len(body)) > MaxCardPicture+3 {
		return "", fmt.Errorf("a card's picture may be at most %d MB", MaxCardPicture>>20)
	}
	b, err := base64.StdEncoding.DecodeString(body)
	if err != nil || len(b) > MaxCardPicture {
		return "", errors.New("a card's picture is a JPEG, PNG or WebP picture, at most 2 MB")
	}
	kind := http.DetectContentType(b)
	ext, ok := cardTypes[kind]
	if !ok || strings.TrimSuffix(strings.TrimPrefix(head, "data:"), ";base64") != kind {
		return "", errors.New("a card's picture is a JPEG, PNG or WebP picture")
	}
	if !cardFits(kind, b) {
		return "", fmt.Errorf("a card's picture is at most %d pixels on a side", MaxCardSide)
	}
	sum := sha256.Sum256(b)
	name := hex.EncodeToString(sum[:16]) + "." + ext
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); err == nil {
		// Already kept: touched, so one put back is not pruned as unused.
		now := time.Now()
		return name, os.Chtimes(path, now, now)
	}
	return name, lockedfile.Write(path, b, 0o600)
}

// cardFits reports whether a picture is at most MaxCardSide on each side,
// read from its header alone (a few kilobytes can say 20,000 pixels square).
func cardFits(kind string, b []byte) bool {
	var w, h int
	if kind == "image/webp" {
		var ok bool
		if w, h, ok = webpSize(b); !ok {
			return false
		}
	} else {
		c, _, err := image.DecodeConfig(bytes.NewReader(b))
		if err != nil {
			return false
		}
		w, h = c.Width, c.Height
	}
	return w > 0 && h > 0 && w <= MaxCardSide && h <= MaxCardSide
}

// ReadCardPicture returns a kept picture as a data URL.
func ReadCardPicture(dir, name string) (string, error) {
	if !pictureName.MatchString(name) {
		return "", fmt.Errorf("no picture %q", name)
	}
	b, err := os.ReadFile(filepath.Join(dir, name)) // #nosec G304 -- a name pictureName allows, in the homelab's own folder
	if os.IsNotExist(err) {
		return "", fmt.Errorf("the picture %s is not kept here any more", name)
	}
	if err != nil {
		return "", err
	}
	return "data:" + http.DetectContentType(b) + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}

// pruneCardPictures removes the pictures no card names that have been
// unused for keepUnused: a card's photo replaced or the card removed, or a
// photo picked in a form never saved. Anything else in the folder stays.
func pruneCardPictures(dir string, p Plan, now time.Time) error {
	used := map[string]bool{}
	for _, c := range p.Collection {
		used[c.Picture] = true
	}
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !e.Type().IsRegular() || !pictureName.MatchString(e.Name()) || used[e.Name()] {
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

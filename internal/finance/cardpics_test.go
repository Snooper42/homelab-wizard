package finance

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// pngURL is a w×h picture as a data URL.
func pngURL(t *testing.T, w, h int) string {
	t.Helper()
	var b bytes.Buffer
	if err := png.Encode(&b, image.NewRGBA(image.Rect(0, 0, w, h))); err != nil {
		t.Fatal(err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(b.Bytes())
}

// A card's own photo (the Collection, PR 3): made small on the device,
// kept on the computer by its content's name, read back by that name
// only; a PDF, a picture that isn't what it says, or one too large to
// show is refused.
func TestCardPictures(t *testing.T) {
	dir := t.TempDir()
	name, err := SaveCardPicture(dir, pngURL(t, 63, 88))
	if err != nil || !pictureName.MatchString(name) || !strings.HasSuffix(name, ".png") {
		t.Fatalf("saved %q %v", name, err)
	}
	again, _ := SaveCardPicture(dir, pngURL(t, 63, 88))
	if again != name {
		t.Errorf("the same picture twice: %s, %s", name, again)
	}
	back, err := ReadCardPicture(dir, name)
	if err != nil || !strings.HasPrefix(back, "data:image/png;base64,") {
		t.Errorf("read back: %.40s %v", back, err)
	}
	for _, bad := range []string{
		"data:application/pdf;base64," + base64.StdEncoding.EncodeToString([]byte("%PDF-1.4")),
		"data:image/jpeg;base64," + strings.TrimPrefix(pngURL(t, 4, 4), "data:image/png;base64,"),
		pngURL(t, 3000, 10),
		"not a picture",
	} {
		if n, err := SaveCardPicture(dir, bad); err == nil {
			t.Errorf("kept %q", n)
		}
	}
	for _, bad := range []string{"../finance.json", "x.png", strings.Repeat("a", 32) + ".gif"} {
		if _, err := ReadCardPicture(dir, bad); err == nil {
			t.Errorf("read %q", bad)
		}
	}
}

// A picture no card names any more goes a day after, when the plan is
// saved; one a card names stays.
func TestUnusedCardPicturesGo(t *testing.T) {
	root := t.TempDir()
	dir := CardPicturesDir(root)
	used, _ := SaveCardPicture(dir, pngURL(t, 10, 14))
	old, _ := SaveCardPicture(dir, pngURL(t, 11, 14))
	fresh, _ := SaveCardPicture(dir, pngURL(t, 12, 14))
	long := time.Now().Add(-48 * time.Hour)
	for _, n := range []string{used, old} {
		if err := os.Chtimes(filepath.Join(dir, n), long, long); err != nil {
			t.Fatal(err)
		}
	}
	p := Plan{Accounts: []Account{{ID: "pokemon", Name: "Pokémon cards", Kind: Collectible}},
		Collection: []Collected{{Account: "pokemon", Name: "Ember Fox", Picture: used}}, Rev: noFile}
	if _, err := Save(Path(root), p); err != nil {
		t.Fatal(err)
	}
	for n, want := range map[string]bool{used: true, old: false, fresh: true} {
		if _, err := os.Stat(filepath.Join(dir, n)); (err == nil) != want {
			t.Errorf("%s kept: %v, want %v", n, err == nil, want)
		}
	}
}

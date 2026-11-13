package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

// The Collection's pictures on a phone: seen at Finances' look level, kept
// (a card's own photo) at its change level, and never a member's.
func TestPhoneCardPictures(t *testing.T) {
	root, _ := repoCopy(t, "")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	read, save := h.phoneMethods()["FinancesCardPicture"], h.phoneMethods()["SaveFinancesCardPicture"]
	if read.Finances != companion.FinancesView || read.Member || read.Change {
		t.Errorf("FinancesCardPicture: %+v", read)
	}
	if save.Finances != companion.FinancesEdit || save.Member {
		t.Errorf("SaveFinancesCardPicture: %+v", save)
	}
	var b bytes.Buffer
	_ = png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 63, 88)))
	arg, _ := json.Marshal("data:image/png;base64," + base64.StdEncoding.EncodeToString(b.Bytes()))
	name, _, err := save.Call(context.Background(), []json.RawMessage{arg})
	if err != nil {
		t.Fatal(err)
	}
	n, _ := json.Marshal(name)
	got, _, err := read.Call(context.Background(), []json.RawMessage{n})
	if s, _ := got.(string); err != nil || !strings.HasPrefix(s, "data:image/png;base64,") {
		t.Errorf("read back: %v %v", got, err)
	}
	if _, _, err := read.Call(context.Background(), []json.RawMessage{json.RawMessage(`"../phones.json"`)}); err == nil {
		t.Error("a name that isn't a picture's was read")
	}
}

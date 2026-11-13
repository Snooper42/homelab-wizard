package main

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/png"
	"strings"
	"testing"
)

// A card's own photo, kept and read back by the desktop app.
func TestFinancesCardPicture(t *testing.T) {
	a := &App{root: t.TempDir()}
	var b bytes.Buffer
	_ = png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 63, 88)))
	name, err := a.SaveFinancesCardPicture("data:image/png;base64," + base64.StdEncoding.EncodeToString(b.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if got, err := a.FinancesCardPicture(name); err != nil || !strings.HasPrefix(got, "data:image/png;base64,") {
		t.Errorf("read back: %.40s %v", got, err)
	}
}

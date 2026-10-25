package tray

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
)

// The icon's usual colours: black for a macOS template icon, blue
// elsewhere so it shows on light and dark panels.
var (
	templateInk = color.NRGBA{A: 255}
	blueInk     = color.NRGBA{R: 0x0A, G: 0x5C, B: 0xC2, A: 255}
)

// attentionInk is the dot on the icon while something needs a look.
var attentionInk = color.NRGBA{R: 0xF5, G: 0x9E, B: 0x0B, A: 255}

// iconPNG draws the house glyph at 32x32 in ink, with an orange dot in its
// corner when dot is set (something needs a look), set apart from the
// house by a clear ring.
func iconPNG(ink color.NRGBA, dot bool) []byte {
	const n = 32
	img := image.NewNRGBA(image.Rect(0, 0, n, n))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			dx := x - 16
			if dx < 0 {
				dx = -dx
			}
			roof := y >= 3 && y <= 15 && dx <= y-2
			body := y >= 15 && y <= 28 && x >= 7 && x <= 25
			door := y >= 19 && x >= 13 && x <= 19
			if (roof || body) && !door {
				img.Set(x, y, ink)
			}
			if dot {
				d := (x-25)*(x-25) + (y-7)*(y-7)
				if d <= 64 {
					img.Set(x, y, color.NRGBA{})
				}
				if d <= 36 {
					img.Set(x, y, attentionInk)
				}
			}
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

// ico wraps a 32x32 PNG in an .ico file, which the Windows tray needs.
func ico(pngData []byte) []byte {
	var b bytes.Buffer
	_ = binary.Write(&b, binary.LittleEndian, []uint16{0, 1, 1}) // reserved, icon, one image
	b.Write([]byte{32, 32, 0, 0})                                // width, height, palette, reserved
	_ = binary.Write(&b, binary.LittleEndian, []uint16{1, 32})   // planes, bits per pixel
	// #nosec G115 -- the size of a small embedded icon
	_ = binary.Write(&b, binary.LittleEndian, []uint32{uint32(len(pngData)), 22})
	b.Write(pngData)
	return b.Bytes()
}

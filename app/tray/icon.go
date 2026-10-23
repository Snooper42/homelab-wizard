package tray

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
)

// iconPNG draws the house glyph at 32x32: black for a macOS template icon,
// blue elsewhere so it shows on light and dark panels.
func iconPNG(colored bool) []byte {
	const n = 32
	ink := color.NRGBA{A: 255}
	if colored {
		ink = color.NRGBA{R: 0x0A, G: 0x5C, B: 0xC2, A: 255}
	}
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

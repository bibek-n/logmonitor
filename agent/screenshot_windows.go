//go:build windows

package main

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"image/png"

	"github.com/kbinani/screenshot"
)

// CaptureScreenshot grabs every active display and composites them side-by-side into a
// single wide image (rather than just the primary monitor), so a multi-monitor desktop
// is fully represented in one screenshot the same way it visually is to the user.
func CaptureScreenshot() ([]byte, error) {
	n := screenshot.NumActiveDisplays()
	if n == 0 {
		return nil, fmt.Errorf("no active displays found")
	}

	if n == 1 {
		bounds := screenshot.GetDisplayBounds(0)
		img, err := screenshot.CaptureRect(bounds)
		if err != nil {
			return nil, fmt.Errorf("capture failed: %w", err)
		}
		return encodePNG(img)
	}

	var totalWidth, maxHeight int
	displays := make([]*image.RGBA, 0, n)
	for i := 0; i < n; i++ {
		bounds := screenshot.GetDisplayBounds(i)
		img, err := screenshot.CaptureRect(bounds)
		if err != nil {
			continue // skip a display that fails to capture rather than aborting the whole shot
		}
		displays = append(displays, img)
		totalWidth += bounds.Dx()
		if bounds.Dy() > maxHeight {
			maxHeight = bounds.Dy()
		}
	}
	if len(displays) == 0 {
		return nil, fmt.Errorf("all displays failed to capture")
	}

	composite := image.NewRGBA(image.Rect(0, 0, totalWidth, maxHeight))
	xOffset := 0
	for _, img := range displays {
		bounds := img.Bounds()
		draw.Draw(composite, image.Rect(xOffset, 0, xOffset+bounds.Dx(), bounds.Dy()), img, bounds.Min, draw.Src)
		xOffset += bounds.Dx()
	}

	return encodePNG(composite)
}

func encodePNG(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("png encode failed: %w", err)
	}
	return buf.Bytes(), nil
}

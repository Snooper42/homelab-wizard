// Package transfer counts a download as it comes in, for the bars that
// show how much of it is in.
package transfer

import (
	"io"
	"time"
)

// Bytes counts a download as it is written, and calls On with how much is
// in (done) of how much there is (total, -1 when the server did not say):
// at the start, at most every Every after that, and at the end (Close).
type Bytes struct {
	W     io.Writer
	Total int64
	On    func(done, total int64)
	// Every is how often On is called while it runs; 0 is a quarter of a
	// second, so a screen is told about four times a second at most.
	Every time.Duration

	done int64
	last time.Time
}

func (b *Bytes) Write(p []byte) (int, error) {
	n, err := b.W.Write(p)
	b.done += int64(n)
	every := b.Every
	if every == 0 {
		every = 250 * time.Millisecond
	}
	if b.On != nil && (b.last.IsZero() || time.Since(b.last) >= every) {
		b.last = time.Now()
		b.On(b.done, b.Total)
	}
	return n, err
}

// Close tells On the last count.
func (b *Bytes) Close() error {
	if b.On != nil {
		b.On(b.done, b.Total)
	}
	return nil
}

// Percent is done of total as 0 to 100; -1 when total is not known.
func Percent(done, total int64) int {
	if total <= 0 {
		return -1
	}
	return int(min(100, done*100/total))
}

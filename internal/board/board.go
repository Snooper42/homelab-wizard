// Package board reads the cards beside Status (the watchdog, alerts,
// storage, usage, the week, protection) side by side, for one request that
// fills them in as each is read rather than one request per card.
package board

import (
	"context"
	"sync"
)

// Card is one card as read: its data, or why it could not be read.
type Card struct {
	// Board is the caller's number for the request it belongs to, so a
	// card from an older request is known.
	Board int    `json:"board"`
	Name  string `json:"name"`
	Data  any    `json:"data"`
	Error string `json:"error,omitempty"`
}

// Reader reads one card.
type Reader func(ctx context.Context) (any, error)

// Readers are the cards a caller can read, by name.
type Readers map[string]Reader

// NotHere is the error of a card asked for that the caller cannot read
// (one the phone does not show, say), so the page treats it as it treats
// any card that could not be read.
const NotHere = "not read here"

// Read reads each card in want side by side and gives it to fn as soon as
// it is read, one at a time, returning when all of them are in. A card
// named twice is read once.
func Read(ctx context.Context, r Readers, board int, want []string, fn func(Card)) {
	var mu sync.Mutex
	var wg sync.WaitGroup
	seen := map[string]bool{}
	for _, name := range want {
		if seen[name] {
			continue
		}
		seen[name] = true
		read, ok := r[name]
		if !ok {
			fn(Card{Board: board, Name: name, Error: NotHere})
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := Card{Board: board, Name: name}
			if v, err := read(ctx); err != nil {
				c.Error = err.Error()
			} else {
				c.Data = v
			}
			mu.Lock()
			defer mu.Unlock()
			fn(c)
		}()
	}
	wg.Wait()
}

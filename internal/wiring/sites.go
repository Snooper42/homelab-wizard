package wiring

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// SearchSites is whether Prowlarr has a search site that works, in words
// for Setup (arr-loop item 5). Nothing downloads until one does, and
// before this nothing said so.
type SearchSites struct {
	Working int    `json:"working"`
	Said    string `json:"said"`
	// Open is Prowlarr's indexers page, where its Add Indexer button is.
	Open string `json:"open,omitempty"`
}

// sitesWhat says what a search site is, in one sentence with no names
// (rule 2: the wizard never names, suggests or adds one).
const sitesWhat = "A search site is where Prowlarr looks for what you ask for in Seerr; you choose and add your own in Prowlarr."

// SearchSites asks Prowlarr which search sites it has, and which it has
// blocked after failing to reach them (its own checks: IndexerStatus's
// DisabledTill). A site that is on and not blocked works. It names no site,
// changes nothing, and asks Prowlarr once rather than waiting for it.
// Prowlarr not running: the zero value.
func (w *Wirer) SearchSites(ctx context.Context) SearchSites {
	p, ok := w.Apps["prowlarr"]
	if !ok {
		return SearchSites{}
	}
	out := SearchSites{Open: strings.TrimRight(p.URL, "/") + "/"}
	key := w.apiKey("prowlarr")
	if key == "" {
		out.Said = "Can't ask Prowlarr about search sites yet: it hasn't finished starting. " + sitesWhat
		return out
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var indexers []struct {
		ID     int  `json:"id"`
		Enable bool `json:"enable"`
	}
	var blocked []struct {
		IndexerID    int        `json:"indexerId"`
		DisabledTill *time.Time `json:"disabledTill"`
	}
	err := w.call(ctx, "prowlarr", key, http.MethodGet, "indexer", nil, &indexers)
	if err == nil {
		err = w.call(ctx, "prowlarr", key, http.MethodGet, "indexerstatus", nil, &blocked)
	}
	if err != nil {
		out.Said = "Can't ask Prowlarr about search sites: it didn't answer."
		return out
	}
	down := map[int]bool{}
	for _, b := range blocked {
		if b.DisabledTill != nil && b.DisabledTill.After(time.Now()) {
			down[b.IndexerID] = true
		}
	}
	on := 0
	for _, i := range indexers {
		if !i.Enable {
			continue
		}
		on++
		if !down[i.ID] {
			out.Working++
		}
	}
	switch {
	case out.Working == 1:
		out.Said = "1 search site works in Prowlarr."
	case out.Working > 1:
		out.Said = strconv.Itoa(out.Working) + " search sites work in Prowlarr."
	case on > 0:
		out.Said = "Prowlarr couldn't reach your search sites lately, so nothing is found. Open Prowlarr to test them, or add another. " + sitesWhat
	case len(indexers) > 0:
		out.Said = "Your search sites are turned off in Prowlarr, so nothing is found. Open Prowlarr and turn one on. " + sitesWhat
	default:
		out.Said = "No search sites yet, so nothing you ask for is found. Open Prowlarr and press Add Indexer. " + sitesWhat
	}
	return out
}

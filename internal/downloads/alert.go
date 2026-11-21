package downloads

import (
	"slices"

	"github.com/Snooper42/homelab-wizard/internal/diskspace"
)

// The drive's warning on the phone (arr item 6): the card's own words, sent
// through ntfy once at warnAt and once at fullAt, not on every pass. What
// was last said is kept by the caller (told: 0, warnAt or fullAt).

// settle is how far below a threshold the drive must go before that
// threshold can be said again, so a drive hovering at 85% is said once.
const settle = 5

// level is the threshold used has reached: 0, warnAt or fullAt.
func level(used int) int {
	switch {
	case used >= fullAt:
		return fullAt
	case used >= warnAt:
		return warnAt
	}
	return 0
}

// DriveAlert is the warning to send now for the fuller of vols ("" for
// none), and what is told after it. A drive that can't be read (not set,
// or unplugged) keeps what was told.
func DriveAlert(vols []diskspace.Volume, told int) (string, int) {
	d := fullest(vols)
	if d == nil {
		return "", told
	}
	if l := level(d.Used); l > told {
		return warning(*d), l
	}
	return "", min(told, level(d.Used+settle))
}

// WithoutNames is the card for a wall screen, which anyone walking past can
// read: each item's state and words, without what it is.
func (c Card) WithoutNames() Card {
	c.Items = slices.Clone(c.Items)
	for i := range c.Items {
		c.Items[i].Name = ""
	}
	return c
}

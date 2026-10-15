package upgrade

import (
	"strings"
	"unicode"
)

// MaxNotes is how many CHANGELOG entries a Check lists.
const MaxNotes = 20

// NewNotes are the CHANGELOG entries (its "- " lines) in next that are not
// in current: what an upgrade brings, in the CHANGELOG's order. Each is
// cut to its first sentence.
func NewNotes(current, next string) []string {
	have := map[string]bool{}
	for _, line := range strings.Split(current, "\n") {
		if e, ok := entry(line); ok {
			have[e] = true
		}
	}
	var out []string
	for _, line := range strings.Split(next, "\n") {
		e, ok := entry(line)
		if !ok || have[e] {
			continue
		}
		have[e] = true // the same entry twice is listed once
		out = append(out, firstSentence(e))
		if len(out) == MaxNotes {
			break
		}
	}
	return out
}

// entry is a top-level list item's text.
func entry(line string) (string, bool) {
	e, ok := strings.CutPrefix(line, "- ")
	e = strings.TrimSpace(e)
	return e, ok && e != ""
}

// firstSentence cuts at the first ". " or ": " followed by a capital
// letter, so a long entry reads as its headline.
func firstSentence(s string) string {
	for i := 0; i+2 < len(s); i++ {
		if (s[i] == '.' || s[i] == ':') && s[i+1] == ' ' && unicode.IsUpper(rune(s[i+2])) {
			if s[i] == '.' {
				return s[:i+1]
			}
			return s[:i]
		}
	}
	return s
}

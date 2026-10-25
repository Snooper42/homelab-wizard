package upgrade

import (
	"strings"
	"unicode"
)

// MaxNotes is how many CHANGELOG entries a Check lists.
const MaxNotes = 20

// NewNotes are the CHANGELOG entries (its "- " lines) in next that are not
// in current: what an upgrade brings, in the CHANGELOG's order. Each is
// cut to its first sentence. Only the sections above the newest version
// both have are read, so notes reworded in an older version are not news.
func NewNotes(current, next string) []string {
	have := map[string]bool{}
	versions := map[string]bool{}
	for _, line := range strings.Split(current, "\n") {
		if e, ok := entry(line); ok {
			have[e] = true
		}
		if v, ok := version(line); ok {
			versions[v] = true
		}
	}
	var out []string
	for _, line := range strings.Split(next, "\n") {
		if v, ok := version(line); ok && versions[v] {
			break
		}
		e, ok := entry(line)
		if !ok || have[e] {
			continue
		}
		have[e] = true // the same entry twice is listed once
		// Shown as plain text, so without the bold.
		out = append(out, strings.ReplaceAll(firstSentence(e), "**", ""))
		if len(out) == MaxNotes {
			break
		}
	}
	return out
}

// version is a released version's heading ("## [0.9.0-beta] - …"), not
// Unreleased's.
func version(line string) (string, bool) {
	rest, ok := strings.CutPrefix(line, "## [")
	v, _, closed := strings.Cut(rest, "]")
	return v, ok && closed && v != "Unreleased"
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

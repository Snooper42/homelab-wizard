package notify

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// Readable is an alert as a person reads it. Duplicati sends its report to
// ntfy as a form (message=…, every space and line encoded), which ntfy
// keeps as it came, and the report itself is its whole log. Such a message
// is decoded, and a Duplicati report becomes a title saying which backup
// and how it ended, and its warnings and errors, at most three. Any other
// message is left as it is.
func Readable(e Event) Event {
	if strings.HasPrefix(e.Message, "message=") {
		if v, err := url.ParseQuery(e.Message); err == nil && v.Get("message") != "" {
			e.Message = v.Get("message")
		}
	}
	if title, body, ok := duplicatiReport(e.Message); ok {
		if e.Title == "" {
			e.Title = title
		}
		e.Message = body
	}
	return e
}

var (
	reportFor   = regexp.MustCompile(`^Duplicati (\w+) report for (.+?)(?: \([^)]*\))?\s*$`)
	parsed      = regexp.MustCompile(`(?m)^\s*ParsedResult:\s*(\w+)`)
	logProblem  = regexp.MustCompile(`\[(Warning|Error)-[^\]]*\]:\s*(.+)`)
	moreEntries = 3
)

// duplicatiReport reads a Duplicati report: its first line names the
// operation and the backup, ParsedResult how it ended, and the log lines
// marked Warning or Error what went wrong.
func duplicatiReport(text string) (title, body string, ok bool) {
	first, rest, _ := strings.Cut(strings.TrimSpace(text), "\n")
	m := reportFor.FindStringSubmatch(strings.TrimSpace(first))
	if m == nil {
		return "", "", false
	}
	op, name := strings.ToLower(m[1]), m[2]
	result := ""
	if p := parsed.FindStringSubmatch(rest); p != nil {
		result = p[1]
	}
	switch result {
	case "Warning":
		title = "The " + op + " of " + name + " finished with warnings"
	case "Error", "Fatal":
		title = "The " + op + " of " + name + " failed"
	case "Success":
		title = "The " + op + " of " + name + " finished"
	default:
		title = "Duplicati: the " + op + " of " + name
	}
	var lines []string
	seen := map[string]bool{}
	for _, l := range strings.Split(rest, "\n") {
		p := logProblem.FindStringSubmatch(l)
		if p == nil {
			continue
		}
		line := strings.TrimRight(strings.TrimSpace(p[2]), ",")
		if seen[line] {
			continue
		}
		seen[line] = true
		lines = append(lines, line)
	}
	if n := len(lines); n > moreEntries {
		lines = append(lines[:moreEntries], "and "+strconv.Itoa(n-moreEntries)+" more in Duplicati's log")
	}
	if len(lines) == 0 {
		lines = []string{"Duplicati's log for this backup has the details."}
	}
	return title, strings.Join(lines, "\n"), true
}

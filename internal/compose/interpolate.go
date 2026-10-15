package compose

import (
	"fmt"
	"strings"
)

// Lookup returns the value of a variable and whether it is set.
type Lookup func(name string) (string, bool)

// MapLookup adapts a map to a Lookup.
func MapLookup(m map[string]string) Lookup {
	return func(name string) (string, bool) {
		v, ok := m[name]
		return v, ok
	}
}

// VarRef is one ${VAR...} reference found in a Compose value.
type VarRef struct {
	Name       string
	Default    string
	HasDefault bool
}

// Interpolate expands Compose-style variables: $$, $VAR, ${VAR}, ${VAR:-def},
// ${VAR-def}, ${VAR:?err}, ${VAR?err}, ${VAR:+alt}, ${VAR+alt}. Defaults may
// themselves contain variables.
func Interpolate(s string, lookup Lookup) (string, error) {
	var b strings.Builder
	for i := 0; i < len(s); {
		c := s[i]
		if c != '$' || i+1 >= len(s) {
			b.WriteByte(c)
			i++
			continue
		}
		next := s[i+1]
		switch {
		case next == '$':
			b.WriteByte('$')
			i += 2
		case next == '{':
			end := matchBrace(s, i+1)
			if end < 0 {
				return "", fmt.Errorf("unclosed ${ in %q", s)
			}
			v, err := expandBraced(s[i+2:end], lookup)
			if err != nil {
				return "", err
			}
			b.WriteString(v)
			i = end + 1
		case isNameStart(next):
			j := i + 1
			for j < len(s) && isNameChar(s[j]) {
				j++
			}
			v, _ := lookup(s[i+1 : j])
			b.WriteString(v)
			i = j
		default:
			b.WriteByte(c)
			i++
		}
	}
	return b.String(), nil
}

// MustInterpolate interpolates and returns the input unchanged on error.
func MustInterpolate(s string, lookup Lookup) string {
	out, err := Interpolate(s, lookup)
	if err != nil {
		return s
	}
	return out
}

// Refs lists the variables referenced by s (including those nested in defaults).
func Refs(s string) []VarRef {
	var refs []VarRef
	for i := 0; i < len(s); i++ {
		if s[i] != '$' || i+1 >= len(s) {
			continue
		}
		switch next := s[i+1]; {
		case next == '$':
			i++
		case next == '{':
			end := matchBrace(s, i+1)
			if end < 0 {
				return refs
			}
			body := s[i+2 : end]
			name, op, rest := splitBraced(body)
			ref := VarRef{Name: name}
			if op == ":-" || op == "-" {
				ref.Default, ref.HasDefault = rest, true
			}
			refs = append(refs, ref)
			if rest != "" {
				refs = append(refs, Refs(rest)...)
			}
			i = end
		case isNameStart(next):
			j := i + 1
			for j < len(s) && isNameChar(s[j]) {
				j++
			}
			refs = append(refs, VarRef{Name: s[i+1 : j]})
			i = j - 1
		}
	}
	return refs
}

func expandBraced(body string, lookup Lookup) (string, error) {
	name, op, rest := splitBraced(body)
	val, set := lookup(name)
	switch op {
	case "":
		return val, nil
	case ":-":
		if !set || val == "" {
			return Interpolate(rest, lookup)
		}
		return val, nil
	case "-":
		if !set {
			return Interpolate(rest, lookup)
		}
		return val, nil
	case ":?":
		if !set || val == "" {
			return "", fmt.Errorf("required variable %s is missing: %s", name, rest)
		}
		return val, nil
	case "?":
		if !set {
			return "", fmt.Errorf("required variable %s is missing: %s", name, rest)
		}
		return val, nil
	case ":+":
		if set && val != "" {
			return Interpolate(rest, lookup)
		}
		return "", nil
	case "+":
		if set {
			return Interpolate(rest, lookup)
		}
		return "", nil
	}
	return "", fmt.Errorf("unsupported substitution ${%s}", body)
}

// splitBraced splits "VAR:-default" into ("VAR", ":-", "default").
func splitBraced(body string) (name, op, rest string) {
	j := 0
	for j < len(body) && isNameChar(body[j]) {
		j++
	}
	name, tail := body[:j], body[j:]
	for _, candidate := range []string{":-", ":?", ":+", "-", "?", "+"} {
		if strings.HasPrefix(tail, candidate) {
			return name, candidate, tail[len(candidate):]
		}
	}
	return name, "", ""
}

// matchBrace returns the index of the "}" closing the "{" at open.
func matchBrace(s string, open int) int {
	depth := 0
	for i := open; i < len(s); i++ {
		switch s[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}

func isNameStart(c byte) bool { return c == '_' || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') }
func isNameChar(c byte) bool  { return isNameStart(c) || (c >= '0' && c <= '9') }

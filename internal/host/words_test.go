package host

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// macWords are the Mac's own words: shown on Windows or Linux they read as
// a Mac app's text. They belong in Mac-only code, or in text that names
// each system.
var macWords = []string{"menu bar", "Finder", "this Mac", "This Mac", "OrbStack", "Dock icon", "⌘"}

// macWordsAllowed are strings outside a Mac branch that may still use one,
// with why: they name the Mac among the systems, or are what the Mac's own
// code compares against.
var macWordsAllowed = []struct{ file, text, why string }{
	{"internal/host/host.go", "", "each system's profile; the Mac's is chosen by its GOOS"},
	{"internal/docker/docker.go", "OrbStack", "recognises OrbStack's engine by name"},
	{"internal/docker/fake.go", "OrbStack", "the fake engine answers as OrbStack"},
	{"cmd/homelab/runtime.go", "on a Mac install OrbStack", "says what each system uses instead"},
	{"cmd/homelab/move.go", "OrbStack on a Mac", "names the Mac's runtime among others"},
	{"cmd/homelab/doctor.go", "this homelab is set up for OrbStack", "printed only on a Mac (hp.OS)"},
	{"cmd/homelab/duplicati.go", "no Proton Drive folder on this Mac", "the Mac's Proton Drive folder, looked for only there"},
	{"app/app.go", "Menu bar icon", "chosen per system"},
	{"app/app.go", "OrbStack", "an example in a comment's field"},
	{"internal/setup/setup.go", "this Mac", "the step's ID and its Mac-only form"},
	{"cmd/homelab/main.go", "macOS with OrbStack, Linux with Docker Engine", "names each system's runtime"},
	{"internal/recovery/kit.go", "(OrbStack on a Mac)", "names the Mac's runtime among others"},
}

func TestNoMacOnlyWordsElsewhere(t *testing.T) {
	_, here, _, _ := runtime.Caller(0)
	repo := filepath.Join(filepath.Dir(here), "..", "..")
	for _, dir := range []string{"cmd", "internal", "app"} {
		_ = filepath.Walk(filepath.Join(repo, dir), func(p string, fi os.FileInfo, err error) error {
			if err != nil || fi.IsDir() && (fi.Name() == "node_modules" || fi.Name() == "testdata") {
				if fi != nil && fi.IsDir() {
					return filepath.SkipDir
				}
				return err
			}
			name := fi.Name()
			if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") || strings.Contains(name, "_darwin") {
				return nil
			}
			rel, _ := filepath.Rel(repo, p)
			checkMacWords(t, filepath.ToSlash(rel), p)
			return nil
		})
	}
}

func checkMacWords(t *testing.T, rel, path string) {
	t.Helper()
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	var stack []ast.Node
	ast.Inspect(f, func(n ast.Node) bool {
		if n == nil {
			stack = stack[:len(stack)-1]
			return true
		}
		stack = append(stack, n)
		lit, ok := n.(*ast.BasicLit)
		if !ok || lit.Kind != token.STRING {
			return true
		}
		s, err := strconv.Unquote(lit.Value)
		if err != nil {
			return true
		}
		for _, w := range macWords {
			if !strings.Contains(s, w) || inMacBranch(stack) || allowedMacWord(rel, s) {
				continue
			}
			at := strings.Index(s, w)
			t.Errorf("%s:%d: …%s… says %q outside Mac-only code; use the system's own word (host.Profile, runtime.GOOS), or add it to macWordsAllowed with why", rel, fset.Position(lit.Pos()).Line, s[max(0, at-40):min(len(s), at+len(w)+40)], w)
		}
		return true
	})
}

// inMacBranch reports whether the innermost node is inside an if or a
// case on "darwin" (runtime.GOOS == "darwin", case "darwin":).
func inMacBranch(stack []ast.Node) bool {
	for i := len(stack) - 2; i >= 0; i-- {
		switch b := stack[i].(type) {
		case *ast.CaseClause:
			for _, e := range b.List {
				if mentionsDarwin(e) {
					return true
				}
			}
		case *ast.IfStmt:
			// The body, or the condition itself (runtime.GOOS == "darwin" &&
			// info.Runtime() != "OrbStack").
			if i+1 < len(stack) && (stack[i+1] == b.Body || stack[i+1] == b.Cond) && mentionsDarwin(b.Cond) {
				return true
			}
		}
	}
	return false
}

func mentionsDarwin(e ast.Node) bool {
	found := false
	ast.Inspect(e, func(n ast.Node) bool {
		if lit, ok := n.(*ast.BasicLit); ok && lit.Value == `"darwin"` {
			found = true
		}
		return !found
	})
	return found
}

func allowedMacWord(rel, s string) bool {
	for _, a := range macWordsAllowed {
		if a.file == rel && strings.Contains(s, a.text) {
			return true
		}
	}
	return false
}

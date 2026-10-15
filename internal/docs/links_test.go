package docs

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCheckLinks(t *testing.T) {
	root := t.TempDir()
	write := func(rel, content string) {
		p := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("docs/Getting Started.md", "x")
	write("docs/images/a.png", "x")
	write("docs/README.md", "# Index\n"+
		"[ok](<Getting Started.md>) [ok](Getting%20Started.md#steps) [anchor](#top) [web](https://example.com)\n"+
		"<img src=\"images/a.png\"> <source srcset=\"images/a.png 2x\">\n"+
		"[broken](<Missing Page.md>) <img src=\"images/b.png\">\n"+
		"`[in code](nope.md)`\n"+
		"```\n[in a block](nope.md)\n```\n")
	issues := CheckLinks(root, "docs", "absent.md")
	if len(issues) != 2 {
		t.Fatalf("want 2 broken links, got %v", issues)
	}
	for i, want := range []string{"broken link to Missing Page.md", "broken link to images/b.png"} {
		if issues[i].Message != want || issues[i].Path != filepath.Join("docs", "README.md") {
			t.Errorf("issue %d: %+v, want %q", i, issues[i], want)
		}
	}
}

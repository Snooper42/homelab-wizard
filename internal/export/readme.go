package export

import (
	"fmt"
	"html/template"
	"io"
	"time"
)

// Part is one thing in the export and how to use it elsewhere.
type Part struct {
	Folder, Title, What, Elsewhere string
}

// Summary is what README.html shows.
type Summary struct {
	Made    time.Time
	Machine string
	Parts   []Part
	Left    []Part   // what stays where it is (already plain files)
	Failed  []string // steps that did not work
}

var readme = template.Must(template.New("readme").Funcs(template.FuncMap{
	"date": func(t time.Time) string { return t.Local().Format("2 January 2006, 15:04") },
}).Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Homelab export</title>
<style>
  :root { color-scheme: light dark; --muted: #667085; --line: #d0d5dd; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; max-width: 780px; margin: 0 auto; padding: 32px 20px 48px; }
  h1 { margin: 0; } .lead { color: var(--muted); margin: 4px 0 24px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 28px 0 8px; }
  .part { border-top: 1px solid var(--line); padding: 10px 0; }
  .part p { margin: 4px 0; } code { font: 13px ui-monospace, Menlo, Consolas, monospace; }
  .bad { color: #b42318; }
</style>
</head>
<body>
<h1>Homelab export</h1>
<p class="lead">Made {{date .Made}} on {{.Machine}}. Everything here is in an open format: it opens without the homelab, and other services import it.</p>
{{- if .Failed}}
<h2>Not exported</h2>
<ul>{{range .Failed}}<li class="bad">{{.}}</li>{{end}}</ul>
{{- end}}
<h2>In this folder</h2>
{{- range .Parts}}
<div class="part"><strong>{{.Title}}</strong> · <code>{{.Folder}}</code><p>{{.What}}</p>{{if .Elsewhere}}<p><em>Elsewhere:</em> {{.Elsewhere}}</p>{{end}}</div>
{{- end}}
{{- if .Left}}
<h2>Already plain files, left where they are</h2>
{{- range .Left}}
<div class="part"><strong>{{.Title}}</strong> · <code>{{.Folder}}</code><p>{{.What}}</p></div>
{{- end}}
{{- end}}
</body>
</html>
`))

// Readme writes README.html.
func Readme(w io.Writer, s Summary) error {
	if err := readme.Execute(w, s); err != nil {
		return fmt.Errorf("the export's README: %w", err)
	}
	return nil
}

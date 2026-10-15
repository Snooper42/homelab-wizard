// Package people is the household: who has been added (their sign-in is
// a Pocket ID account), and the welcome page each gets with their apps,
// the phone apps to install, and their first sign-in link.
package people

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Person is one member of the household.
type Person struct {
	Username string    `json:"username"`
	Name     string    `json:"name"`
	Email    string    `json:"email,omitempty"`
	PocketID string    `json:"pocketId"` // their id in Pocket ID
	Added    time.Time `json:"added"`
	// Removed is when their sign-in was turned off; zero while they are in.
	Removed time.Time `json:"removed"`
	// Apps are the apps they use, by id; none means every household app.
	Apps []string `json:"apps,omitempty"`
}

// Uses reports whether the person uses an app.
func (p Person) Uses(id string) bool {
	if len(p.Apps) == 0 {
		return true
	}
	for _, a := range p.Apps {
		if a == id {
			return true
		}
	}
	return false
}

// Active reports whether the person can sign in.
func (p Person) Active() bool { return p.Removed.IsZero() }

// Path is the household list in the homelab folder.
func Path(root string) string { return filepath.Join(root, "data", "people.json") }

// WelcomePath is a person's welcome page.
func WelcomePath(root, username string) string {
	return filepath.Join(root, "data", "people", username+".html")
}

// Load reads the household; none yet is an empty list.
func Load(path string) ([]Person, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var out []Person
	return out, json.Unmarshal(data, &out)
}

// Save writes the household, sorted by name.
func Save(path string, list []Person) error {
	sort.Slice(list, func(i, j int) bool { return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name) })
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(list, "", "  ")
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

// Find is the person with this username or name (case aside).
func Find(list []Person, who string) (int, bool) {
	for i, p := range list {
		if strings.EqualFold(p.Username, who) || strings.EqualFold(p.Name, who) {
			return i, true
		}
	}
	return -1, false
}

var notUsername = regexp.MustCompile(`[^a-z0-9._-]+`)

// plain turns common accented letters into their plain ones, for usernames.
var plain = strings.NewReplacer("à", "a", "á", "a", "â", "a", "ä", "a", "å", "a", "ã", "a", "æ", "ae", "ç", "c", "è", "e", "é", "e", "ê", "e", "ë", "e",
	"ì", "i", "í", "i", "î", "i", "ï", "i", "ñ", "n", "ò", "o", "ó", "o", "ô", "o", "ö", "o", "ø", "o", "õ", "o", "ß", "ss", "ù", "u", "ú", "u", "û", "u", "ü", "u", "ý", "y", "ÿ", "y")

// Username turns a name into a username: "Anna Smith" is "anna".
func Username(name string) string {
	first := strings.Fields(plain.Replace(strings.ToLower(name)))
	if len(first) == 0 {
		return ""
	}
	return strings.Trim(notUsername.ReplaceAllString(first[0], ""), "._-")
}

// Split is a name's first name and the rest.
func Split(name string) (first, last string) {
	f := strings.Fields(name)
	if len(f) == 0 {
		return "", ""
	}
	return f[0], strings.Join(f[1:], " ")
}

// App is one app on a welcome page.
type App struct {
	Name, Address, What, Phone string
}

// Welcome is what a welcome page shows.
type Welcome struct {
	Person    Person
	Household string // e.g. "The Smith homelab"; empty for "Your homelab"
	SignIn    string // the one-time link to add a passkey
	Until     time.Time
	Issuer    string // Pocket ID's address
	Apps      []App
	// Tailnet: the apps are on the tailnet (Home mode), so the person's
	// devices need Tailscale first.
	Tailnet bool
	// StartPage is their own tab on the household's Homepage, if it runs.
	StartPage string
}

var page = template.Must(template.New("welcome").Funcs(template.FuncMap{
	"date":  func(t time.Time) string { return t.Local().Format("Monday 2 January") },
	"first": func(name string) string { f, _ := Split(name); return f },
}).Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome, {{first .Person.Name}}</title>
<style>
  :root { color-scheme: light dark; --muted: #667085; --line: #d0d5dd; --accent: #2563eb; }
  body { font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 48px; }
  h1 { font-size: 30px; margin: 0 0 4px; }
  .lead { color: var(--muted); margin: 0 0 28px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 32px 0 10px; }
  ol.steps { padding-left: 22px; } ol.steps li { margin: 8px 0; }
  .link { display: inline-block; margin-top: 6px; padding: 10px 16px; border-radius: 10px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 600; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 8px; border-top: 1px solid var(--line); vertical-align: top; }
  td small, li small { display: block; color: var(--muted); }
  a { color: var(--accent); }
  @media print { .link { color: #000; background: none; border: 1px solid #000; } }
</style>
</head>
<body>
<h1>Welcome, {{first .Person.Name}}</h1>
<p class="lead">{{if .Household}}{{.Household}}{{else}}Your homelab{{end}}: photos, passwords, films, and more, kept at home.</p>

<h2>First, once</h2>
<ol class="steps">
{{- if .Tailnet}}
  <li>Install <strong>Tailscale</strong> on your phone and computer, and sign in with the account you were invited to. The addresses below open only with it on.</li>
{{- end}}
  <li>Open this link on your phone and add a <strong>passkey</strong> (Face ID or Touch ID). It is your sign-in for the apps below; there is no password to remember.{{if .SignIn}}<br><a class="link" href="{{.SignIn}}">{{.SignIn}}</a><br><small>It works once, until {{date .Until}}. After that, sign in at {{.Issuer}} with your passkey.</small>{{end}}</li>
  <li>In each app, choose <strong>Sign in with Pocket ID</strong> where it is offered.</li>
</ol>

<h2>Your apps</h2>
{{- if .StartPage}}
<p>All of them on one page, to keep as a bookmark or on the Home Screen: <a href="{{.StartPage}}">{{.StartPage}}</a></p>
{{- end}}
<table>
{{- range .Apps}}
  <tr><td><strong>{{.Name}}</strong><small>{{.What}}</small></td><td><a href="{{.Address}}">{{.Address}}</a>{{if .Phone}}<small>Phone app: {{.Phone}}</small>{{end}}</td></tr>
{{- end}}
</table>
</body>
</html>
`))

// Render writes a welcome page.
func Render(w io.Writer, wel Welcome) error {
	if err := page.Execute(w, wel); err != nil {
		return fmt.Errorf("the welcome page: %w", err)
	}
	return nil
}

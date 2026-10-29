// Package recovery is the printable recovery kit: where the backups are,
// where the passphrases are kept (never the passphrases themselves), the
// accounts the homelab depends on, and the steps to restore it on a new
// machine. Print it and keep it with the household's important papers.
package recovery

import (
	"fmt"
	"html/template"
	"io"
	"time"
)

// Job is one backup job and what it holds.
type Job struct{ Name, Holds string }

// Kit is what the page shows.
type Kit struct {
	Made        time.Time
	Machine     string // e.g. "macOS 26.0 · Mac mini (M4)"
	Root        string // the homelab folder
	Destination string // BACKUP_DESTINATION
	Domain      string // empty in Home mode
	TailnetHost string
	Repository  string // where the homelab's files come from
	Jobs        []Job
	Apps        []string // the apps that run, by name
	People      []string
}

var page = template.Must(template.New("kit").Funcs(template.FuncMap{
	"date": func(t time.Time) string { return t.Local().Format("2 January 2006") },
}).Parse(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Homelab recovery kit</title>
<style>
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #111; background: #fff; max-width: 760px; margin: 0 auto; padding: 32px 24px; }
  h1 { font-size: 28px; margin: 0; }
  .lead { color: #555; margin: 4px 0 24px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #555; margin: 26px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; } td { padding: 6px 8px 6px 0; vertical-align: top; border-bottom: 1px solid #eee; }
  td:first-child { width: 34%; color: #555; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; }
  .write { display: inline-block; min-width: 320px; border-bottom: 1px solid #111; height: 1.4em; }
  ol li { margin: 6px 0; }
  .note { border: 1px solid #111; padding: 10px 14px; margin: 18px 0; }
  @media print { body { padding: 0; } a { color: #111; text-decoration: none; } }
</style>
</head>
<body>
<h1>Homelab recovery kit</h1>
<p class="lead">Made {{date .Made}} on {{.Machine}}. Print it, keep it with the household's papers, and make a new one when something below changes. It holds no passwords: it says where they are.</p>

<div class="note"><strong>If the homelab is gone</strong> (the machine died, was stolen, or burned), everything comes back from the backups with two things: access to the backup folder, and the Secrets passphrase. Both are described below.</div>

<h2>Where the backups are</h2>
<table>
  <tr><td>Backup folder</td><td><code>{{.Destination}}</code></td></tr>
  <tr><td>What is in it</td><td>{{range $i, $j := .Jobs}}{{if $i}}<br>{{end}}<strong>{{$j.Name}}</strong>: {{$j.Holds}}{{end}}</td></tr>
  <tr><td>Encrypted with</td><td>Duplicati (AES-256). Each job is its own folder there.</td></tr>
</table>

<h2>Where the passphrases are</h2>
<table>
  <tr><td>Secrets passphrase (<code>DUPLICATI_SECRETS_PASSPHRASE</code>)</td><td>Opens <em>Homelab Secrets</em>, which holds every other password. Kept in the password manager (Vaultwarden) and written here:<br><span class="write"></span></td></tr>
  <tr><td>Password manager master password</td><td>Each person's own; Vaultwarden itself comes back from the backups. Keep an encrypted export (Bitwarden › Tools › Export vault) with its password outside the vault.</td></tr>
  <tr><td>Everything else</td><td>In <code>.env</code>, inside <em>Homelab Secrets</em>.</td></tr>
</table>

<h2>Accounts the homelab depends on</h2>
<table>
  <tr><td>The homelab's files</td><td>{{if .Repository}}<code>{{.Repository}}</code>{{else}}Homelab Wizard (it carries them){{end}}</td></tr>
{{- if .Domain}}
  <tr><td>Domain and DNS</td><td><code>{{.Domain}}</code> at Cloudflare (the tunnel and the certificate use it)</td></tr>
{{- end}}
{{- if .TailnetHost}}
  <tr><td>Tailscale</td><td>The tailnet the apps are on: <code>{{.TailnetHost}}</code></td></tr>
{{- end}}
  <tr><td>Backup folder's cloud</td><td>The account that syncs <code>{{.Destination}}</code> (Proton Drive, iCloud Drive, or the like), and its password</td></tr>
</table>

<h2>What ran here</h2>
<p>{{range $i, $a := .Apps}}{{if $i}}, {{end}}{{$a}}{{end}}.</p>
{{- if .People}}
<p>People in the household: {{range $i, $p := .People}}{{if $i}}, {{end}}{{$p}}{{end}}.</p>
{{- end}}

<h2>To restore on a new machine</h2>
<ol>
  <li>Install the container runtime (OrbStack on a Mac) and Homelab Wizard. On Setup, choose <strong>Set it up for me</strong>, or put the homelab's files in <code>{{.Root}}</code>.</li>
  <li>Make the backup folder appear on the new machine (sign in to its cloud drive, or plug in the drive).</li>
  <li>Start only Duplicati (<code>./homelab install duplicati</code>), open it, and choose Restore › <em>Direct restore from backup files</em>: the <code>secrets</code> folder, with the Secrets passphrase. Put <code>homelab.env</code> back as <code>.env</code> in the homelab folder, and the files in its <code>data</code> folder (the household, paired phones, and sign-in settings) into <code>data</code> there.</li>
  <li>The same way, with <code>DUPLICATI_PASSPHRASE</code> from that <code>.env</code>, restore <code>appdata</code> to <code>data/appdata</code>, <code>stack-data</code> to <code>appdata</code>, and <code>databases</code> to <code>recovery-staging</code>.</li>
  <li>Start the homelab (<strong>Start the homelab</strong>, or <code>./homelab up</code>), load each database from its dump (docs/Disaster Recovery.md), and work down Setup again: addresses, alerts, scheduled jobs, and <strong>Create the backup jobs</strong>, which picks up the existing backups.</li>
  <li>Check: Status all green, and a photo, a password, and a document open on a phone.</li>
</ol>
<p>The full steps are in <code>docs/Disaster Recovery.md</code> in the homelab folder.</p>
</body>
</html>
`))

// Render writes the kit.
func Render(w io.Writer, k Kit) error {
	if err := page.Execute(w, k); err != nil {
		return fmt.Errorf("the recovery kit: %w", err)
	}
	return nil
}

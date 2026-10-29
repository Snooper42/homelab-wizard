package backup

import "github.com/Snooper42/homelab-wizard/internal/catalog"

// SourcesFor lists what the nightly backup copies for the installed apps:
// each database marked dump, and each volume listed under archive. waiting,
// when not nil, says which drive a stopped app waits for.
func SourcesFor(c *catalog.Catalog, installed func(*catalog.App) bool, waiting func(*catalog.App) string) []Source {
	var sources []Source
	for _, app := range c.Apps {
		if app.Native() != nil || !installed(app) {
			continue
		}
		drive := ""
		if waiting != nil {
			drive = waiting(app)
		}
		if app.Meta.Dump != "" {
			sources = append(sources, Source{ID: app.ID, Name: app.Name(), WaitingFor: drive})
		}
		for _, v := range app.Meta.Archive {
			sources = append(sources, Source{ID: v, Name: app.Name() + " (" + v + ")", Volume: true, WaitingFor: drive})
		}
	}
	return sources
}

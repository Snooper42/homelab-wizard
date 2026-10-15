package backup

import "github.com/Snooper42/homelab-wizard/internal/catalog"

// SourcesFor lists what the nightly backup copies for the installed apps:
// each database marked dump, and each volume listed under archive.
func SourcesFor(c *catalog.Catalog, installed func(*catalog.App) bool) []Source {
	var sources []Source
	for _, app := range c.Apps {
		if app.Native() != nil || !installed(app) {
			continue
		}
		if app.Meta.Dump != "" {
			sources = append(sources, Source{ID: app.ID, Name: app.Name()})
		}
		for _, v := range app.Meta.Archive {
			sources = append(sources, Source{ID: v, Name: app.Name() + " (" + v + ")", Volume: true})
		}
	}
	return sources
}

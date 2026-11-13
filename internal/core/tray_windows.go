package core

// ownFolder: on Windows the tray's folder is under this account's own
// AppData (its temporary folder too), which other accounts cannot open.
func ownFolder(dir string) error { return nil }

// Package realdocker takes a homelab through its life against a real
// Docker Engine: install, data in each app through its own API, the
// nightly backup, the watchdog's cases, an update and its rollback, then
// the homelab moved out, wiped, moved in, and the data read back.
//
// The tests need Docker and the network, so they build only with the
// realdocker tag (go test -tags realdocker ./test/realdocker). CI runs them
// every night on a Linux runner (.github/workflows/nightly.yml), and on
// pull requests that change the catalog. REALDOCKER_APPS picks some apps
// for a run on a machine that cannot reach every registry.
package realdocker

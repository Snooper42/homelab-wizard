## Summary

## Safety impact

- [ ] Does not expose an app to the internet by default
- [ ] Does not write secrets anywhere but `.env` (mode 0600), nor print them
- [ ] Does not delete data without a backup and a confirmation first
- [ ] Does not claim it works on a machine unless it was actually tried there

## Validation

- [ ] `go vet ./...` and `go test ./...`
- [ ] `go run ./cmd/homelab validate`, and `go run ./cmd/homelab docs --check` when compose files, metadata, or docs changed
- [ ] `make check app-check frontend-check app-smoke`
- [ ] Tried on a machine, if it changes what runs (docs/Testing.md has the steps)

## Notes

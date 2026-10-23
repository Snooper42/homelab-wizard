VERSION := $(shell cat VERSION)
COMPOSE_FILES := compose.yaml $(wildcard stacks/*/compose.yaml)
# One project per category, run from the homelab folder.
CATEGORY_FILES := $(wildcard compose/*.yaml)

.PHONY: build test lint check compose-config app app-check screenshots frontend frontend-check app-smoke help

build:
	go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o bin/homelab ./cmd/homelab

test:
	go test ./...

lint:
	@test -z "$$(gofmt -l cmd internal)" || (gofmt -l cmd internal; exit 1)
	go vet ./...
	bash -n homelab dockerfiles/npm-crowdsec/homelab-init.sh app/packaging/appimage.sh app/packaging/appimage-smoke.sh
	sh -n install.sh

# What CI runs: formatting, vet, tests, and the catalog/docs validation.
check: lint test
	go run ./cmd/homelab --root . validate

# Needs the docker compose CLI (no engine): checks every project's syntax.
compose-config:
	@for f in $(COMPOSE_FILES); do \
		docker compose --project-directory "$$(dirname $$f)" -f "$$f" --env-file .env.example --profile optional config --quiet && echo "ok  $$f" || exit 1; \
	done
	@for f in $(CATEGORY_FILES); do \
		docker compose --project-directory . -f "$$f" --env-file .env.example --profile optional config --quiet && echo "ok  $$f" || exit 1; \
	done

# The desktop app (separate module; needs the Wails CLI, see app/README.md).
app:
	cd app && wails build -ldflags "-X main.version=$(VERSION)"
	@# On macOS the menu bar item is a helper inside the bundle.
	@if [ "$$(uname)" = Darwin ]; then cd app && b="$$(ls -d build/bin/*.app)" && mkdir -p "$$b/Contents/Helpers" && go build -o "$$b/Contents/Helpers/homelab-tray" ./cmd/homelab-tray; fi

# Pictures of the app for the docs (docs/images), from the frontend in
# Chromium with a fake backend; needs Node and Playwright, not Wails.
screenshots:
	node app/preview/shoot.mjs

# Clicks through the buttons that run commands against the fake backend
# (needs Playwright and Chromium, like screenshots).
app-smoke:
	node app/preview/shoot.mjs --smoke

# The frontend's scripts parse, every ID the app looks up exists, web/src
# type-checks against the Go side (web/types), and web/dist/app.js was
# built from it (no browser).
frontend-check:
	node app/preview/lint.mjs
	@test -d node_modules || npm ci --silent
	npx --no-install tsc -p .
	node web/build.mjs --check

# Compiles web/src into web/dist/app.js (commit both).
frontend:
	@test -d node_modules || npm ci --silent
	node web/build.mjs

# Compiles the app without cgo or a GUI toolkit, as a quick check.
app-check:
	@cd app && (test -z "$$(gofmt -l .)" || (gofmt -l .; exit 1))
	cd app && GOOS=windows go vet ./... && GOOS=windows go build -o /dev/null . && GOOS=windows GOARCH=arm64 go build -o /dev/null .

# What each target does.
help:
	@echo "make build           the CLI into bin/homelab"
	@echo "make check           gofmt, vet, bash -n, tests, and homelab validate (what CI runs)"
	@echo "make compose-config  every compose file's syntax (needs the docker compose CLI)"
	@echo "make app             the desktop app with Wails (see app/README.md)"
	@echo "make app-check       the app module's formatting, vet, and Windows builds"
	@echo "make frontend        compile web/src (TypeScript) into web/dist/app.js"
	@echo "make frontend-check  the frontend's scripts parse, its IDs exist, it type-checks, and web/dist is built"
	@echo "make app-smoke       click through the app against a fake backend (Playwright)"
	@echo "make screenshots     redraw docs/images (Playwright)"

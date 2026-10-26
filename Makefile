VERSION := $(shell cat VERSION)
COMPOSE_FILES := compose.yaml $(wildcard stacks/*/compose.yaml)
# One project per category, run from the homelab folder.
CATEGORY_FILES := $(wildcard compose/*.yaml)

.PHONY: build test lint check security compose-config app app-check screenshots frontend frontend-check app-smoke help

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

# Known vulnerabilities in the Go code, its dependencies, and the Go it is
# built with (govulncheck, for macOS, Linux, and Windows), risky patterns
# in the Go code (gosec), and known vulnerabilities in the frontend's
# packages (npm audit). Needs the network. The gosec rules left out, and
# why: docs/Security.md#the-apps-own-code.
GOSEC_EXCLUDE := G104,G204,G301,G302,G304,G306,G702,G703
security:
	GOTOOLCHAIN=$$(go env GOVERSION) GOBIN=$(CURDIR)/bin go install golang.org/x/vuln/cmd/govulncheck@v1.9.0
	GOTOOLCHAIN=$$(go env GOVERSION) GOBIN=$(CURDIR)/bin go install github.com/securego/gosec/v2/cmd/gosec@v2.30.0
	GOOS=darwin bin/govulncheck ./...
	GOOS=linux bin/govulncheck ./...
	GOOS=windows bin/govulncheck ./...
	cd app && GOOS=linux ../bin/govulncheck ./...
	cd app && GOOS=windows ../bin/govulncheck -tags desktop,production ./...
	bin/gosec -quiet -exclude=$(GOSEC_EXCLUDE) ./...
	cd app && ../bin/gosec -quiet -exclude=$(GOSEC_EXCLUDE) ./...
	cd app && GOOS=windows ../bin/gosec -quiet -tags desktop,production -exclude=$(GOSEC_EXCLUDE) ./...
	@test -d node_modules || npm ci --silent
	npm audit --omit=dev
	npm audit --audit-level=high

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

# Clicks through the buttons that run commands against the fake backend,
# in light and dark, then checks each screen as each system with axe
# (accessibility) and for a broken layout; CI runs it on every pull
# request. Needs npm ci (Playwright and axe-core) and Chromium.
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
	@echo "make security        known vulnerabilities and risky code (govulncheck, gosec, npm audit; needs the network)"
	@echo "make compose-config  every compose file's syntax (needs the docker compose CLI)"
	@echo "make app             the desktop app with Wails (see app/README.md)"
	@echo "make app-check       the app module's formatting, vet, and Windows builds"
	@echo "make frontend        compile web/src (TypeScript) into web/dist/app.js"
	@echo "make frontend-check  the frontend's scripts parse, its IDs exist, it type-checks, and web/dist is built"
	@echo "make app-smoke       click through the app and check each screen with axe (Playwright)"
	@echo "make screenshots     redraw docs/images (Playwright)"

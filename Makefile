VERSION := $(shell cat VERSION)
COMPOSE_FILES := compose.yaml $(wildcard stacks/*/compose.yaml)
# One project per category, run from the homelab folder.
CATEGORY_FILES := $(wildcard compose/*.yaml)

.PHONY: build test lint check coverage music-pins music-pins-check security compose-config app app-check screenshots frontend frontend-check app-smoke phone-finance-wasm phone-finance-framework help

build:
	go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o bin/homelab ./cmd/homelab

test:
	go test ./...
	python3 -m unittest discover -s tools/media/tests

lint:
	@test -z "$$(gofmt -l cmd internal mobile)" || (gofmt -l cmd internal mobile; exit 1)
	go vet ./...
	go vet -tags forreal ./...
	python3 -m py_compile tools/media/*.py
	bash -n homelab dockerfiles/npm-crowdsec/homelab-init.sh app/packaging/appimage.sh app/packaging/appimage-smoke.sh
	sh -n install.sh

# What CI runs: formatting, vet, tests, and the catalog/docs validation.
check: lint test
	go run ./cmd/homelab --root . validate

# Finances' projection on a phone that keeps a member's Finances sealed
# (mobile/finance, .claude/prompts/private-finances.md 3.2): the same Go the
# computer runs, built for the phone. phone-finance-wasm builds the web
# page's finance.wasm, says its size (over 4 MB compressed is the owner's
# call), and runs the golden views under it with Node; the environment is
# kept small, as Go's WebAssembly runner refuses a large one.
PHONE_WASM_LIMIT := 4194304
phone-finance-wasm:
	@mkdir -p bin
	GOOS=js GOARCH=wasm go build -trimpath -ldflags "-s -w" -o bin/finance.wasm ./cmd/financewasm
	@raw=$$(wc -c < bin/finance.wasm); gz=$$(gzip -9 -c bin/finance.wasm | wc -c); \
	  echo "finance.wasm: $$raw bytes, $$gz gzip-compressed"; \
	  if [ -n "$$GITHUB_STEP_SUMMARY" ]; then echo "**finance.wasm:** $$raw bytes, $$gz compressed (gzip -9)" >> "$$GITHUB_STEP_SUMMARY"; fi; \
	  if [ $$gz -gt $(PHONE_WASM_LIMIT) ]; then echo "over 4 MB compressed: ask the owner first (private-finances.md 3.2)"; exit 1; fi
	env -i HOME="$$HOME" PATH="$$(go env GOROOT)/lib/wasm:$$PATH" GOCACHE="$$(go env GOCACHE)" GOMODCACHE="$$(go env GOMODCACHE)" \
	  GOPATH="$$(go env GOPATH)" GOTOOLCHAIN="$$(go env GOTOOLCHAIN)" GOOS=js GOARCH=wasm go test -count=1 ./mobile/finance

# phone-finance-framework binds the same package for the iPhone app with
# gomobile (on a Mac with Xcode, gomobile and gobind installed), in a new
# module of its own under bin/ each time, so go.mod gains nothing, and says
# the sizes: the whole xcframework, the iPhone's own part, and that part's
# code and data, which is what an app ships once its link drops the debug
# information (Apple's strip can't read Go's archive, so size counts it).
MOBILE_VERSION := v0.0.0-20261011034528-197770444867
phone-finance-framework:
	@mkdir -p bin
	@d=$$(mktemp -d "$$PWD/bin/bind.XXXXXX") && cd "$$d" && echo "binding in $$d" && \
	  go mod init example.invalid/bind && \
	  go mod edit -require=github.com/Snooper42/homelab-wizard@v0.0.0 -replace=github.com/Snooper42/homelab-wizard=../.. && \
	  printf 'package bind\n\nimport (\n\t_ "github.com/Snooper42/homelab-wizard/mobile/finance"\n\t_ "golang.org/x/mobile/bind"\n)\n' > bind.go && \
	  go get golang.org/x/mobile@$(MOBILE_VERSION) && go mod tidy && \
	  gomobile bind -target=ios,iossimulator -trimpath -ldflags "-s -w" -o HomelabFinance.xcframework github.com/Snooper42/homelab-wizard/mobile/finance && \
	  all=$$(du -sk HomelabFinance.xcframework | cut -f1) && \
	  lib=$$(find HomelabFinance.xcframework/ios-arm64 -type f -name HomelabFinance | head -1) && \
	  dev=$$(wc -c < "$$lib") && \
	  shipped=$$(xcrun size -m "$$lib" | awk '/^Segment/ {seg = $$2} /Section/ { if ($$0 ~ /\(__DWARF/ || seg ~ /^__DWARF/) next; n = $$NF; if (n ~ /^[0-9]+$$/) s += n } END {print s + 0}') && \
	  if [ "$$shipped" -le 0 ]; then echo "size counted no code in $$lib: the count is wrong, not the framework"; exit 1; fi && \
	  echo "HomelabFinance.xcframework: $$all KB in all; the iPhone's part $$dev bytes, $$shipped of it code and data (what an app ships, without debug info)" && \
	  if [ -n "$$GITHUB_STEP_SUMMARY" ]; then echo "**HomelabFinance.xcframework:** $$all KB in all; the iPhone's part $$dev bytes, $$shipped of it code and data (what an app ships)" >> "$$GITHUB_STEP_SUMMARY"; fi

# Each package's test coverage against its floor in coverage-floors.txt
# (CI runs it): raise a floor as tests are added, never lower it without a
# reason in the pull request.
coverage:
	@mkdir -p bin
	go test -count=1 -coverprofile=bin/cover.out ./... > /dev/null
	cd app && go test -count=1 -coverprofile=../bin/cover-app.out ./... > /dev/null
	tail -n +2 bin/cover-app.out >> bin/cover.out
	go run ./internal/tools/coverfloor bin/cover.out coverage-floors.txt

# Tidy Up's music setup installs only these, checked against their hashes (N28): one file per
# Python it supports. Remake them with uv; then try each in a fresh venv made the way the setup
# makes it (python -m venv, its own pip, --require-hashes), with each Python uv can find here.
MUSIC_PYTHONS := 3.10 3.11 3.12 3.13 3.14
music-pins:
	for v in $(MUSIC_PYTHONS); do { \
		echo "# Tidy Up's music setup for Python $$v: every package pinned, with its hashes (N28)."; \
		echo "# Made by make music-pins from music.in; tried in a fresh venv by make music-pins-check."; \
		uv pip compile -q --universal --python-version $$v --generate-hashes --no-header \
			--index-url https://pypi.org/simple tools/media/requirements/music.in; \
	} > tools/media/requirements/music-$$v.txt || exit 1; done

music-pins-check:
	for v in $(MUSIC_PYTHONS); do \
		py=$$(uv python find $$v) && "$$py" -m venv --clear build/music-pins/$$v && \
		build/music-pins/$$v/bin/python -m pip install --quiet --disable-pip-version-check --require-hashes \
			-r tools/media/requirements/music-$$v.txt && \
		BEETSDIR=build/music-pins/$$v/beets build/music-pins/$$v/bin/python -c "import beets, mediafile, requests, pylast, PIL, acoustid; \
			from beets.ui import main; main(['version'])" && \
		echo "Python $$v: the pins install and beets runs" || exit 1; done

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
	node app/preview/words.mjs
	node app/preview/companion.mjs
	node web/build.mjs --check

# Compiles web/src into web/dist/app.js (commit both).
frontend:
	@test -d node_modules || npm ci --silent
	node web/build.mjs

# Compiles the app without cgo or a GUI toolkit, as a quick check.
app-check:
	@cd app && (test -z "$$(gofmt -l .)" || (gofmt -l .; exit 1))
	cd app && go vet -tags forreal . ./tray
	cd app && GOOS=windows go vet ./... && GOOS=windows go build -o /dev/null . && GOOS=windows GOARCH=arm64 go build -o /dev/null .

# What each target does.
help:
	@echo "make build           the CLI into bin/homelab"
	@echo "make check           gofmt, vet, bash -n, tests, and homelab validate (what CI runs)"
	@echo "make coverage        each package's test coverage against its floor (coverage-floors.txt)"
	@echo "make security        known vulnerabilities and risky code (govulncheck, gosec, npm audit; needs the network)"
	@echo "make compose-config  every compose file's syntax (needs the docker compose CLI)"
	@echo "make app             the desktop app with Wails (see app/README.md)"
	@echo "make app-check       the app module's formatting, vet, and Windows builds"
	@echo "make frontend        compile web/src (TypeScript) into web/dist/app.js"
	@echo "make frontend-check  the frontend's scripts parse, its IDs exist, it type-checks, and web/dist is built"
	@echo "make app-smoke       click through the app and check each screen with axe (Playwright)"
	@echo "make screenshots     redraw docs/images (Playwright)"

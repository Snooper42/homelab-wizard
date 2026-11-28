#!/usr/bin/env bash
# Repository hygiene: what CI checks on each pull request, and what the
# weekly run (.github/workflows/repo-hygiene.yml) keeps up to date.
#
#   scripts/repo-hygiene.sh                    # the same as --check
#   scripts/repo-hygiene.sh --check            # attribution, links, versions
#   scripts/repo-hygiene.sh --check-deps       # go mod tidy changes nothing
#   scripts/repo-hygiene.sh --check-generated  # the generated docs are current
#   scripts/repo-hygiene.sh --fix              # go mod tidy, regenerate docs
#
# Several can be given at once. --check:
#   - no AI-attribution line (a co-author or session trailer, a "Generated
#     with Claude Code" footer) outside .claude/ and .githooks/
#   - every internal Markdown link resolves, and each page's version:
#     front matter is VERSION's (homelab validate)
#   - VERSION is a plain version number; app/wails.json's productVersion is
#     a placeholder the release build overwrites, so it is only reported
#
# Exits non-zero when a check fails. Needs Go (and Git).
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root" || exit 1
check=0 deps=0 generated=0 fix=0
[ $# -eq 0 ] && check=1
for a in "$@"; do
	case "$a" in
	--check) check=1 ;;
	--check-deps) deps=1 ;;
	--check-generated) generated=1 ;;
	--fix) fix=1 ;;
	-h | --help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
	*) echo "unknown option: $a" >&2; exit 2 ;;
	esac
done

failed=0
fail() { echo "✗ $*"; failed=$((failed + 1)); }
ok() { echo "✓ $*"; }

# The lines that say an AI tool wrote a commit or a pull request. The
# Finances payee *ANTHROPIC CLAUDE* (a card merchant) is product data and
# matches none of them.
attribution='^[[:space:]]*(Co-Authored-By:.*(Claude|anthropic)|Claude-Session:|(🤖[[:space:]]*)?_?Generated (with|by) \[Claude Code\]\()|claude\.ai/code/session_'

if [ "$fix" = 1 ]; then
	for d in . app; do
		(cd "$d" && go mod tidy) && ok "go mod tidy in $d" || fail "go mod tidy in $d"
	done
	go run ./cmd/homelab --root . docs >/dev/null && ok "generated docs rewritten (homelab docs)" || fail "homelab docs"
fi

if [ "$check" = 1 ]; then
	hits="$(git grep -n -I -i -E "$attribution" -- . ':!.claude/' ':!.githooks/' ':!scripts/repo-hygiene.sh' ':!.github/workflows/repo-hygiene.yml' 2>/dev/null || true)"
	if [ -n "$hits" ]; then
		fail "AI-attribution lines outside .claude/ and .githooks/:"
		printf '%s\n' "$hits" | head -20 | sed 's/^/    /'
	else
		ok "no AI-attribution lines"
	fi
	if out="$(go run ./cmd/homelab --root . validate 2>&1)"; then
		ok "links and docs versions ($(printf '%s\n' "$out" | tail -1 | sed 's/^[ ✓]*//'))"
	else
		fail "homelab validate:"
		printf '%s\n' "$out" | grep -v '^\s*✓' | tail -20 | sed 's/^/    /'
	fi
	v="$(tr -d '[:space:]' < VERSION)"
	if [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
		ok "VERSION is $v"
	else
		fail "VERSION is not a version number: '$v'"
	fi
	w="$(sed -n 's/.*"productVersion"[^"]*"\([^"]*\)".*/\1/p' app/wails.json | head -1)"
	[ -n "$w" ] && [ "$w" != "$v" ] && echo "  (app/wails.json's productVersion is $w, a placeholder: the release build writes the version it builds)"
fi

if [ "$deps" = 1 ]; then
	for d in . app; do
		if (cd "$d" && go mod tidy -diff >/dev/null 2>&1); then
			ok "go mod tidy changes nothing in $d"
		else
			fail "go mod tidy would change $d (run scripts/repo-hygiene.sh --fix):"
			(cd "$d" && go mod tidy -diff 2>/dev/null | head -20 | sed 's/^/    /')
		fi
	done
fi

if [ "$generated" = 1 ]; then
	if out="$(go run ./cmd/homelab --root . docs --check 2>&1)"; then
		ok "generated docs are current"
	else
		fail "generated docs are out of date (run scripts/repo-hygiene.sh --fix):"
		printf '%s\n' "$out" | tail -15 | sed 's/^/    /'
	fi
fi

[ "$failed" = 0 ] && exit 0
echo "$failed check(s) failed"
exit 1

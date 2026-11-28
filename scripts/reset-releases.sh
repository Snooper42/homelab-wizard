#!/usr/bin/env bash
# Takes the builds between minor versions off the GitHub releases page.
#
# Since 0.17.0 every merge to main published a release (v0.17.1 … v0.47.x),
# about 300 of them. This keeps the ones worth keeping and lists or deletes
# the rest (docs/Release Process.md):
#
#   kept:   the repository's Latest, every minor or major (vX.Y.0, which the
#           stable channel takes), `nightly` and `beta-nightly`, drafts, and
#           anything not named vX.Y.Z
#   pruned: the patch builds, vX.Y.Z with Z > 0
#
# Tags are kept unless --tags is given: the iPhone app's version, the next
# version the release workflow picks, and `homelab upgrade` read them, and
# testdata/upgrades keeps a folder for some (those are never deleted).
#
#   scripts/reset-releases.sh                    # dry run: what would go
#   scripts/reset-releases.sh --apply --confirm  # delete those releases
#   scripts/reset-releases.sh --apply --confirm --tags   # and their tags
#
# Needs the GitHub CLI (gh), signed in with a login that may delete releases.
set -euo pipefail

repo="${REPO:-Snooper42/homelab-wizard}"
apply=0 confirm=0 tags=0
usage() { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; }
while [ $# -gt 0 ]; do
	case "$1" in
	--dry-run) apply=0 ;;
	--apply) apply=1 ;;
	--confirm) confirm=1 ;;
	--tags) tags=1 ;;
	--repo) repo="$2"; shift ;;
	-h | --help) usage; exit 0 ;;
	*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
	esac
	shift
done
if [ "$apply" = 1 ] && [ "$confirm" != 1 ]; then
	echo "--apply deletes releases: add --confirm as well to go ahead (or run without --apply to see what would go)" >&2
	exit 2
fi
command -v gh >/dev/null || { echo "needs the GitHub CLI: https://cli.github.com (then gh auth login)" >&2; exit 1; }

root="$(cd "$(dirname "$0")/.." && pwd)"
protected=" "
if [ -d "$root/testdata/upgrades" ]; then
	for d in "$root"/testdata/upgrades/v*/; do [ -d "$d" ] && protected="$protected$(basename "$d") "; done
fi

latest="$(gh api "repos/$repo/releases/latest" --jq .tag_name 2>/dev/null || true)"
keep=() prune=()
while IFS=$'\t' read -r tag draft; do
	[ -n "$tag" ] || continue
	if [ "$draft" = true ] || [ "$tag" = "$latest" ] || [ "$tag" = nightly ] || [ "$tag" = beta-nightly ]; then
		keep+=("$tag")
	elif [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.0$ ]] || ! [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		keep+=("$tag")
	else
		prune+=("$tag")
	fi
done < <(gh api --paginate "repos/$repo/releases?per_page=100" --jq '.[] | [.tag_name, (.draft | tostring)] | @tsv')

echo "Releases in $repo: $(( ${#keep[@]} + ${#prune[@]} )); Latest is ${latest:-none}"
echo "Kept: ${#keep[@]} (Latest, each vX.Y.0, nightly, drafts, others)"
echo "To take off the releases page: ${#prune[@]} patch builds$([ "$tags" = 1 ] && echo ", with their tags" || echo "; their tags stay")"
if [ "${#prune[@]}" -gt 0 ]; then
	printf '  %s\n' "${prune[@]:0:15}"
	[ "${#prune[@]}" -gt 15 ] && echo "  … and $(( ${#prune[@]} - 15 )) more"
fi
if [ "$apply" != 1 ]; then
	echo
	echo "Dry run: nothing changed. To delete them: $0 --apply --confirm$([ "$tags" = 1 ] && echo " --tags")"
	exit 0
fi

failed=0
for tag in "${prune[@]}"; do
	cleanup=()
	if [ "$tags" = 1 ]; then
		case "$protected" in
		*" $tag "*) echo "keeping the tag $tag: testdata/upgrades/$tag needs it" ;;
		*) cleanup=(--cleanup-tag) ;;
		esac
	fi
	if gh release delete "$tag" --repo "$repo" --yes "${cleanup[@]}" >/dev/null; then
		echo "deleted the release $tag${cleanup:+ and its tag}"
	else
		echo "could not delete $tag" >&2
		failed=$((failed + 1))
	fi
done
echo "Done: $(( ${#prune[@]} - failed )) deleted, $failed failed."
[ "$failed" = 0 ]

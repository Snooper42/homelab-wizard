#!/usr/bin/env bash
# Finds the remote branches whose work is already on main, and deletes them
# when asked. Everything else is listed, never deleted.
#
#   scripts/cleanup-branches.sh                  # dry run: what would go
#   scripts/cleanup-branches.sh --apply          # delete those branches
#   scripts/cleanup-branches.sh --older-than 14  # also list unmerged ones
#                                                  untouched for 14 days
#
# A branch counts as on main when its tip is in main's history, or merging
# it into main would change nothing (a squash merge already took it). It is
# never deleted when it is main, gh-pages or iphone-screenshots, this
# checkout's own branch, the head of an open pull request, or changed in the
# last 24 hours. Needs Git; the open pull requests need the GitHub CLI (gh),
# and without it no branch is deleted.
set -euo pipefail

remote=origin apply=0 older=0
while [ $# -gt 0 ]; do
	case "$1" in
	--dry-run) apply=0 ;;
	--apply) apply=1 ;;
	--older-than) older="$2"; shift ;;
	--remote) remote="$2"; shift ;;
	-h | --help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
	*) echo "unknown option: $1" >&2; exit 2 ;;
	esac
	shift
done

git fetch --quiet --prune "$remote"
main="$remote/main"
main_tree="$(git rev-parse "$main^{tree}")"
current="$(git branch --show-current 2>/dev/null || true)"
now="$(date +%s)"

open_heads=""
# owner/name from the remote's address (https, ssh, or a proxy's path).
repo="${REPO:-$(git remote get-url "$remote" | sed -E 's#\.git$##; s#/+$##' | awk -F'[/:]' '{print $(NF-1) "/" $NF}')}"
if command -v gh >/dev/null && heads="$(gh api --paginate "repos/$repo/pulls?state=open&per_page=100" --jq '.[].head.ref' 2>/dev/null)"; then
	open_heads=" $(printf '%s\n' "$heads" | tr '\n' ' ') "
else
	echo "No GitHub CLI signed in: can't see the open pull requests, so nothing will be deleted." >&2
	apply=0
fi

delete=() kept=()
while read -r ref; do
	name="${ref#"$remote"/}"
	case "$name" in main | HEAD | gh-pages | iphone-screenshots | "$remote") continue ;; esac
	when="$(git log -1 --format=%ct "$ref")"
	age_days=$(( (now - when) / 86400 ))
	why=""
	if [ "$name" = "$current" ]; then why="this checkout's branch"
	elif [[ "$open_heads" == *" $name "* ]]; then why="an open pull request's"
	elif [ $(( now - when )) -lt 86400 ]; then why="changed in the last 24 hours"
	fi
	on_main=0
	if git merge-base --is-ancestor "$ref" "$main"; then on_main=1
	elif t="$(git merge-tree --write-tree "$main" "$ref" 2>/dev/null | head -1)" && [ "$t" = "$main_tree" ]; then on_main=1
	fi
	if [ "$on_main" = 1 ] && [ -z "$why" ]; then
		delete+=("$name")
	elif [ "$on_main" = 1 ]; then
		kept+=("$name: on main, kept ($why)")
	elif [ "$older" -gt 0 ] && [ "$age_days" -ge "$older" ]; then
		kept+=("$name: NOT on main, untouched for $age_days days ($(git rev-list --count "$main..$ref") commits of its own): keep or drop is the owner's call")
	else
		kept+=("$name: not on main${why:+, $why}")
	fi
done < <(git for-each-ref --format='%(refname:short)' "refs/remotes/$remote")

echo "Already on main, to delete: ${#delete[@]}"
[ "${#delete[@]}" -gt 0 ] && printf '  %s\n' "${delete[@]}"
echo "Kept: ${#kept[@]}"
[ "${#kept[@]}" -gt 0 ] && printf '  %s\n' "${kept[@]}"
if [ "$apply" != 1 ]; then
	echo
	echo "Dry run: nothing deleted.$([ "${#delete[@]}" -gt 0 ] && echo " To delete them: $0 --apply")"
	exit 0
fi
for name in "${delete[@]}"; do
	git push --quiet "$remote" --delete "$name" && echo "deleted $remote/$name"
done

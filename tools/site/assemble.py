#!/usr/bin/env python3
"""The docs website's source, assembled from the repository as it is.

    python3 tools/site/assemble.py            (writes build/site-src)
    mkdocs build -f tools/site/mkdocs.yml     (writes build/site)

The Markdown is written for GitHub, and stays that way: this copies the
pages a reader browses (the README as the home page, docs/, services/, the
iPhone app's README, CONTRIBUTING, SECURITY) into build/site-src at the same
paths, so every relative link between them works unchanged. On the way it
makes three things the site reads differently from GitHub:

- a link to a file that isn't on the site (code, a script, a workflow)
  becomes a link to that file on GitHub;
- a link written with angle brackets, for a name with spaces, is written
  with %20 instead, which every Markdown reader takes;
- GitHub's alert boxes (> [!NOTE]) become the site's own (!!! note).
"""

import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "build" / "site-src"
GITHUB = "https://github.com/Snooper42/homelab-wizard/blob/main/"

# What the site carries, as repository paths: folders whole, and single files.
FOLDERS = ["docs", "services", "assets"]
FILES = {"README.md": "index.md", "CONTRIBUTING.md": "CONTRIBUTING.md", "SECURITY.md": "SECURITY.md",
         "CHANGELOG.md": "CHANGELOG.md", "apple-client/README.md": "apple-client/README.md"}

LINK = re.compile(r"(\]\()(<[^>]+>|[^)\s]+)(\))")
ATTR = re.compile(r'((?:src|href|srcset)=")([^"]+)(")')
ALERT = re.compile(r"^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n((?:>.*\n?)*)", re.M)
KINDS = {"NOTE": "note", "TIP": "tip", "IMPORTANT": "info", "WARNING": "warning", "CAUTION": "danger"}


def on_site(repo_path: str) -> str | None:
    """Where a repository file is on the site, or None when it isn't there."""
    if repo_path in FILES:
        return FILES[repo_path]
    if any(repo_path == f or repo_path.startswith(f + "/") for f in FOLDERS):
        return repo_path
    return None


def fix_target(target: str, page_repo: Path, page_site: Path) -> str:
    """A link's target, as the site needs it."""
    angle = target.startswith("<") and target.endswith(">")
    raw = target[1:-1] if angle else target
    if re.match(r"^[a-z][a-z0-9+.-]*:|^#|^/", raw):
        return target
    path, frag = (raw.split("#", 1) + [""])[:2]
    repo = (page_repo.parent / unquote(path)).resolve()
    try:
        rel = repo.relative_to(ROOT).as_posix()
    except ValueError:
        return target
    site = on_site(rel)
    if site is None:
        return GITHUB + quote(rel) + ("#" + frag if frag else "")
    # Relative to where this page sits on the site (the README moved to index.md).
    link = os.path.relpath(site, page_site.parent.as_posix() or ".")
    return quote(link) + ("#" + frag if frag else "")


def convert(text: str, page_repo: Path, page_site: Path) -> str:
    def alert(m: re.Match) -> str:
        body = re.sub(r"^> ?", "    ", m.group(2), flags=re.M)
        return f"!!! {KINDS[m.group(1)]}\n\n{body}\n"
    text = ALERT.sub(alert, text)
    text = LINK.sub(lambda m: m.group(1) + fix_target(m.group(2), page_repo, page_site) + m.group(3), text)
    def attr(m: re.Match) -> str:
        if m.group(1).startswith("srcset"):
            parts = [fix_target(p.strip(), page_repo, page_site) for p in m.group(2).split(",")]
            return m.group(1) + ", ".join(parts) + m.group(3)
        return m.group(1) + fix_target(m.group(2), page_repo, page_site) + m.group(3)
    return ATTR.sub(attr, text)


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    pages = []
    for folder in FOLDERS:
        for f in (ROOT / folder).rglob("*"):
            if f.is_file():
                pages.append((f, Path(f.relative_to(ROOT))))
    for src, dst in FILES.items():
        pages.append((ROOT / src, Path(dst)))
    for src, dst in pages:
        target = OUT / dst
        target.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix == ".md":
            target.write_text(convert(src.read_text(encoding="utf-8"), src, dst), encoding="utf-8")
        else:
            shutil.copy2(src, target)
    print(f"build/site-src: {sum(1 for _ in OUT.rglob('*.md'))} pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Books: books_organizer.py (the owner's engine, vendored and never edited) run with a time limit on
each tool it starts. A cover read with sips or a book written by calibredb could hang on a file someone
else made and hold Tidy Up's lock for good; here each call that has no limit of its own gets one, and
the engine says the step failed as it does for any other error. The owner chose this on Nov 12.

  python3 books_run.py <the same arguments as books_organizer.py>
"""
import contextlib
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import books_organizer as bo  # noqa: E402

# Seconds a tool may take when the engine set no limit: a cover is a small picture; everything else
# (calibredb writing covers and metadata, listing a big library) gets an hour.
TOOL_LIMITS = {"sips": 60}
DEFAULT_LIMIT = 3600

_real_run = subprocess.run


def _limited_run(cmd, *args, **kwargs):
    if kwargs.get("timeout") is None:
        first = cmd[0] if isinstance(cmd, (list, tuple)) and cmd else cmd
        kwargs["timeout"] = TOOL_LIMITS.get(Path(str(first)).name, DEFAULT_LIMIT)
    return _real_run(cmd, *args, **kwargs)


@contextlib.contextmanager
def limits():
    """subprocess.run with a limit on each call, for as long as the engine runs."""
    before = subprocess.run
    subprocess.run = _limited_run
    try:
        yield
    finally:
        subprocess.run = before


def main():
    with limits():
        bo.run_main(bo.main)


if __name__ == "__main__":
    main()

#!/bin/sh
# Starts as root so a bind-mounted data folder owned by the host user can be
# handed to the unprivileged `node` user, then drops privileges before running
# the app. Without this, a host folder mounted at /data is not writable by
# uid 1000 and SQLite fails with SQLITE_CANTOPEN.
set -e

if [ "$(id -u)" = "0" ]; then
	for dir in "${DATA_DIR:-/data}" "$(dirname "${DATABASE_URL:-/data/crumbs.db}")"; do
		mkdir -p "$dir"
		# Only touch entries not already owned by node, so restarts on a large
		# attachment folder stay fast.
		find "$dir" \! -user node -exec chown node:node {} + ||
			echo "warning: could not change ownership of $dir; it must be writable by uid 1000" >&2
	done
	exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Started with an explicit non-root user (e.g. `user:` in compose): run as-is.
exec "$@"

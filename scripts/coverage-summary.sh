#!/usr/bin/env bash
# Writes a coverage summary table to $GITHUB_STEP_SUMMARY (or stdout if not in CI).
# Usage: scripts/coverage-summary.sh <title> <json-summary-path>
set -euo pipefail

TITLE="${1:?Usage: coverage-summary.sh <title> <json-summary-path>}"
JSON="${2:?Usage: coverage-summary.sh <title> <json-summary-path>}"

if [ ! -f "$JSON" ]; then
  echo "Coverage summary not found: $JSON" >&2
  exit 0
fi

# Resolve to absolute path for require()
ABS_JSON="$(cd "$(dirname "$JSON")" && pwd)/$(basename "$JSON")"

# Extract totals with node (available in CI, no jq dependency)
read -r stmts branches funcs lines < <(node -e "
  const s = require('$ABS_JSON').total;
  console.log(s.statements.pct, s.branches.pct, s.functions.pct, s.lines.pct);
")

TABLE="## $TITLE

| Metric | Coverage |
|--------|----------|
| Statements | ${stmts}% |
| Branches | ${branches}% |
| Functions | ${funcs}% |
| Lines | ${lines}% |
"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "$TABLE" >> "$GITHUB_STEP_SUMMARY"
else
  echo "$TABLE"
fi

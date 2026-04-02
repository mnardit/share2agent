#!/bin/bash
# Release script: creates clean orphan main from dev, excluding internal files
set -e

# Files to EXCLUDE from public release
EXCLUDE=(
  CLAUDE.md
  STORE.md
  LAUNCH_PLAN.md
  PRODUCT_STRATEGY.md
  share2agent-receiver.service
  test-webhook.py
  content-debug.js
  icons/icon-full.png
  "docs/plans"
  ".dashboard-uploads"
  ".dashboard-uploads.json"
)

echo "=== Share2Agent Release ==="

# Must be on dev
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "dev" ]; then
  echo "ERROR: must be on dev branch (currently on $BRANCH)"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: uncommitted changes on dev. Commit first."
  exit 1
fi

# Get version from manifest
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
echo "Version: $VERSION"

# Create orphan main
git checkout --orphan main-release

# Remove excluded files from index
for f in "${EXCLUDE[@]}"; do
  git rm -rf --cached "$f" 2>/dev/null || true
done

# Commit
git commit -m "Share2Agent v${VERSION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Replace main
git branch -D main 2>/dev/null || true
git branch -m main-release main

# Push
git push --force origin main

# Return to dev
git checkout dev

echo ""
echo "=== Released v${VERSION} to main ==="
echo "Files excluded: ${EXCLUDE[*]}"

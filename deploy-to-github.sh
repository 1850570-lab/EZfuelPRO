#!/bin/bash
# Deploy script for EZ Fuel Pro → GitHub
# Run from inside the project folder: bash deploy-to-github.sh

set -e

EMAIL="1850570@gmail.com"
USERNAME="1850570-lab"
REPO="https://github.com/1850570-lab/EZfuelPRO.git"

cd "$(dirname "$0")"
echo "→ Working in: $(pwd)"
echo ""

# If a previous failed .git exists, nuke it for a clean start
if [ -d .git ]; then
  echo "→ Removing existing .git for clean init..."
  rm -rf .git
fi

# Clean up any sandbox-broken backup-staging folder if it exists
if [ -d _deploy ]; then
  echo "→ Skipping _deploy/ via .gitignore"
fi

echo "→ Configuring git..."
git config --global init.defaultBranch main
git init -b main
git config user.email "$EMAIL"
git config user.name "$USERNAME"

echo "→ Staging files (.gitignore handles backup folders)..."
git add .

# Sanity check
FILE_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
echo "→ Files staged: $FILE_COUNT"
if [ "$FILE_COUNT" -lt 10 ]; then
  echo "ERROR: Only $FILE_COUNT files staged — something's off. Aborting."
  exit 1
fi

echo "→ Committing..."
git commit -m "Initial: EZ Fuel Pro site"

echo "→ Adding remote..."
git remote add origin "$REPO" 2>/dev/null || git remote set-url origin "$REPO"

echo ""
echo "============================================"
echo "  Ready to push to: $REPO"
echo "  When prompted:"
echo "    Username: $USERNAME"
echo "    Password: <paste your GitHub Personal Access Token>"
echo "             (Get one: https://github.com/settings/tokens/new"
echo "              with 'repo' scope checked)"
echo "============================================"
echo ""

git push -u origin main

echo ""
echo "✅ DONE! Now enable GitHub Pages:"
echo "   https://github.com/1850570-lab/EZfuelPRO/settings/pages"
echo "   Source: Deploy from a branch"
echo "   Branch: main / (root)  →  Save"
echo ""
echo "Site will be live at:"
echo "   https://1850570-lab.github.io/EZfuelPRO/"

#!/usr/bin/env bash
# Builds jigglesaw and publishes it to GitHub Pages: the gh-pages branch
# serves vixipop.github.io/repertoire/, and this puts the build in its
# jigglesaw/ folder. Everything else on that branch (pond/, the root page)
# is left as it is.
set -euo pipefail
cd "$(dirname "$0")"

npm run build

site=$(mktemp -d)
git fetch -q origin gh-pages
git worktree add -q --detach "$site" origin/gh-pages
trap 'git worktree remove --force "$site"' EXIT

rm -rf "$site/jigglesaw"
cp -r dist "$site/jigglesaw"
cd "$site"
git add -A jigglesaw
if git diff --cached --quiet; then
  echo "jigglesaw: nothing new to deploy"
else
  git commit -q -m "jigglesaw: deploy $(git -C "$OLDPWD" rev-parse --short HEAD)"
  git push -q origin HEAD:gh-pages
  echo "jigglesaw: deployed to https://vixipop.github.io/repertoire/jigglesaw/"
fi

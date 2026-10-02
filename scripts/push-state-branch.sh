#!/usr/bin/env bash
# Persist runtime files to a state branch WITHOUT ever touching workflow files.
#
# Usage: scripts/push-state-branch.sh <branch> <commit message> <path>...
#   Each <path> is taken from the working tree: a file is added, a directory
#   adds every file under it, an absent path is removed from the branch.
#   Env: GITHUB_TOKEN, GITHUB_REPOSITORY (both set in every Actions job).
#
# Why this exists: state branches used to be rebuilt as <current main> + one
# data commit and force-pushed. Whenever .github/workflows on main changed
# since the branch was last written, that push also "updated workflow files"
# relative to the branch, and GitHub refuses it for the Actions token
# ("refusing to allow a GitHub App to create or update workflow ... without
# `workflows` permission") — the run went red and its state was NOT persisted
# (Daily Screening run 36991549616, 2 Oct 2026). The commit is now built as
# <the branch's own tip tree> + these paths, parented on that tip, so only the
# named paths can ever differ from what the branch already holds. Every reader
# takes single files off these branches (git checkout/show FETCH_HEAD -- path),
# never their tree, so the tip's older workflow files are inert. A branch that
# does not exist yet is created from the current checkout (HEAD) as before.
set -euo pipefail

branch="${1:?usage: push-state-branch.sh <branch> <message> <path>...}"
message="${2:?commit message required}"
shift 2
[ "$#" -gt 0 ] || { echo "::error::push-state-branch: no paths given for ${branch}"; exit 1; }
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}" "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
remote_url="${STATE_PUSH_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

GIT_INDEX_FILE="$(mktemp -u)"
export GIT_INDEX_FILE
trap 'rm -f "$GIT_INDEX_FILE"' EXIT

rc=0
git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1 || rc=$?
tip=""
if [ "$rc" -eq 0 ]; then
  git fetch --quiet origin "$branch" --depth=1
  tip="$(git rev-parse FETCH_HEAD)"
  git read-tree "$tip"
  parent_args=(-p "$tip")
elif [ "$rc" -eq 2 ]; then
  # Branch genuinely absent: first write, seeded from this checkout.
  git read-tree HEAD
  parent_args=(-p "$(git rev-parse HEAD)")
else
  echo "::error::could not read ${branch} (ls-remote rc=${rc}) - refusing to rebuild the branch blind"
  exit 1
fi

add_file() { git update-index --add --cacheinfo "100644,$(git hash-object -w "$1"),$1"; }
for p in "$@"; do
  if [ -d "$p" ]; then
    while IFS= read -r -d '' f; do add_file "$f"; done < <(find "$p" -type f -print0)
  elif [ -e "$p" ]; then
    add_file "$p"
  else
    git update-index --force-remove "$p"
  fi
done

tree="$(git write-tree)"
if [ -n "$tip" ] && [ "$tree" = "$(git rev-parse "${tip}^{tree}")" ]; then
  echo "${branch}: state unchanged — nothing to push"
  exit 0
fi
commit="$(git -c user.name="${GIT_AUTHOR_NAME:-$(git config user.name || echo state-bot)}" \
               -c user.email="${GIT_AUTHOR_EMAIL:-$(git config user.email || echo actions@github.com)}" \
               commit-tree "$tree" "${parent_args[@]}" -m "$message")"

for attempt in 1 2 3 4 5; do
  if git push --force "$remote_url" "${commit}:refs/heads/${branch}"; then
    echo "state persisted to ${branch} (${commit})"
    exit 0
  fi
  echo "push to ${branch} failed (attempt ${attempt}) — retrying"
  sleep $((attempt * 3))
done
echo "::error::state push to ${branch} failed after 5 attempts — state NOT persisted"
exit 1

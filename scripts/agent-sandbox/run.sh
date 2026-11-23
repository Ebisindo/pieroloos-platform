#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run from inside a Git repository." >&2
  exit 2
}
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="${PIEROLO_AGENT_SANDBOX_IMAGE:-pieroloos-agent-sandbox:node22}"
NETWORK="${PIEROLO_AGENT_SANDBOX_NETWORK:-bridge}"

case "$NETWORK" in bridge|none) ;; *) echo "Network must be bridge or none." >&2; exit 2 ;; esac
command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 2; }
docker info >/dev/null 2>&1 || { echo "Docker daemon unavailable." >&2; exit 2; }

# Existing check reads tracked path names only; it never opens environment files.
node "$REPO_ROOT/scripts/check-env-file-boundary.mjs"
git -C "$REPO_ROOT" diff --quiet HEAD -- || {
  echo "Commit or stash tracked source changes before sandboxing." >&2; exit 2;
}
[[ -z "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)" ]] || {
  echo "Move/commit non-ignored untracked files before sandboxing." >&2; exit 2;
}

STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}/pieroloos-agent-sandbox"
mkdir -p "$STATE_ROOT"
SNAPSHOT="$(mktemp -d "$STATE_ROOT/workspace.XXXXXXXX")"
PATCH_FILE="$STATE_ROOT/agent-changes-$(date -u +%Y%m%dT%H%M%SZ)-$$.patch"
cleanup() { rm -rf -- "$SNAPSHOT"; }
trap cleanup EXIT

# Only committed objects enter the container. Ignored/untracked files, .git,
# host HOME, credentials and any host environment files are excluded.
git -C "$REPO_ROOT" archive --format=tar HEAD | tar -xf - -C "$SNAPSHOT"
git -C "$SNAPSHOT" init --quiet
git -C "$SNAPSHOT" config user.name "PieroloOS Agent Sandbox"
git -C "$SNAPSHOT" config user.email "agent-sandbox@localhost.invalid"
git -C "$SNAPSHOT" add -A
git -C "$SNAPSHOT" commit --quiet -m "Sandbox baseline"

docker build --pull --tag "$IMAGE" --file "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
UID_VALUE="$(id -u)"
GID_VALUE="$(id -g)"
ARGS=(
  run --rm --init
  --network "$NETWORK"
  --read-only
  --cap-drop ALL
  --security-opt no-new-privileges:true
  --pids-limit 256
  --memory 4g
  --cpus 2
  --shm-size 256m
  --tmpfs "/tmp:rw,nosuid,nodev,size=512m"
  --tmpfs "/home/sandbox:rw,nosuid,nodev,uid=$UID_VALUE,gid=$GID_VALUE,mode=0700,size=256m"
  --user "$UID_VALUE:$GID_VALUE"
  --env HOME=/home/sandbox
  --env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  --volume "$SNAPSHOT:/workspace:rw"
  --workdir /workspace
)
if [[ -t 0 && -t 1 ]]; then ARGS+=(--interactive --tty); fi
if [[ $# -eq 0 ]]; then set -- bash -l; fi

echo "Only the committed Git tree is mounted. Host env files, HOME, SSH, Git credentials and Docker socket are not mounted."
echo "Network mode: $NETWORK (set PIEROLO_AGENT_SANDBOX_NETWORK=none for offline mode)."
docker "${ARGS[@]}" "$IMAGE" "$@"

# Never export a diff if its index contains a real env-file path.
while IFS= read -r -d '' path; do
  base="${path##*/}"
  if [[ "$base" =~ ^\.env ]] && [[ ! "$base" =~ ^\.env(\..+)?\.example$ ]]; then
    echo "Patch export refused due to a tracked environment-file path; contents were not read." >&2
    exit 3
  fi
done < <(git -C "$SNAPSHOT" ls-files -z)

git -C "$SNAPSHOT" add -N -- . 2>/dev/null || true
git -C "$SNAPSHOT" diff --binary HEAD > "$PATCH_FILE"
if [[ -s "$PATCH_FILE" ]]; then
  echo "Review patch: $PATCH_FILE"
  printf 'Apply after review: git apply --check %q && git apply %q\n' "$PATCH_FILE" "$PATCH_FILE"
else
  rm -f "$PATCH_FILE"
  echo "No source changes to export."
fi

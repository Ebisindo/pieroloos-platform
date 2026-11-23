# PieroloOS Agent Sandbox

## Purpose

Run repository agents in a dedicated Docker container whose workspace comes only from the committed Git tree. Real ignored/untracked environment files are not mounted or copied into the container. The container also receives no host home directory, SSH keys, Git credentials, provider tokens, Docker socket, or inherited host environment variables.

This is an enforceable boundary for agents launched **through this wrapper**. It does not protect an agent launched directly on the host or in an unrestricted Codespace.

## Prerequisites

- Docker Engine or Docker Desktop installed and running.
- Git, Bash, tar, and Node.js on the host.
- A clean worktree. Commit/stash tracked changes and move non-ignored untracked files before starting.

## Start a session

From the repository root, offline networking is the default:

```bash
scripts/agent-sandbox/run.sh
```

Run a specific agent command instead:

```bash
scripts/agent-sandbox/run.sh <agent-command> <arguments>
```

The default is `--network none`. For a reviewed task that explicitly requires general outbound network access, opt in:

```bash
PIEROLO_AGENT_SANDBOX_NETWORK=bridge scripts/agent-sandbox/run.sh
```

**Bridge mode permits general outbound access and is not an egress allowlist.** Use it only for a reviewed workload; use `none` for untrusted/offline tasks. A separately approved egress proxy policy is preferable for connected untrusted workloads.

Do not forward host secrets into the container. Use an approved short-lived credential broker where necessary; this change does not configure a broker.

## Controls

The wrapper checks tracked environment-file path names only, requires a clean tracked and non-ignored untracked worktree, and then creates a snapshot using `git archive HEAD`. The archive excludes ignored/untracked files and host `.git`. Only that disposable snapshot is mounted at `/workspace`.

The container has a read-only root filesystem, writable source snapshot, tmpfs temporary and home directories, dropped Linux capabilities, `no-new-privileges`, process/memory/CPU limits, and a non-root user. Host HOME, SSH, cloud credentials, Git credentials, local sockets and Docker socket are not mounted; host environment variables are not inherited.

At exit, source changes are exported as a patch under:

```
${XDG_STATE_HOME:-$HOME/.local/state}/pieroloos-agent-sandbox/
```

Review the patch and exact path before applying it. Run the printed `git apply --check` command and inspect the patch before applying; the wrapper never applies patches automatically and blocks export if the sandbox index contains a real environment-file path.

## Image reproducibility

The Docker base image is pinned by immutable digest. The Git and CA certificate Debian package versions are declared as build arguments and installed by exact version. Update these values only with a reviewed image/package refresh, then run the complete sandbox and security CI.

## Limits

- Only processes launched through this wrapper receive this protection.
- Git archive includes committed files only; commit or stash changes first. Submodule contents are not copied by default.
- Bridge mode allows general outbound network access; it is not an egress allowlist. The default `none` mode has no network.
- Docker daemon and host-kernel vulnerabilities remain outside this boundary.
- This does not replace secret rotation, least-privilege cloud IAM, CI secret management, or separate staging/production identities.

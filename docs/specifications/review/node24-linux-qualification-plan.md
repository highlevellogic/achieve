# Node.js 24.22.2 Linux qualification plan

## Purpose and safety

`.github/workflows/node24-linux-qualification.yml` is a manually triggered,
Ubuntu-only release gate for exactly Node.js 24.22.2. It does not publish,
release, push, or alter the normal Node 22 workflow. It has only
`contents: read` permission and a 30-minute timeout. No step uses
`continue-on-error`, `|| true`, or ignored exit codes.

## Coverage

1. `npm ci` installs the lockfile.
2. `tests/run-verifiers.js --report ...` runs all 37 suites and the next step
   requires 37 passes with zero Linux environmental skips.
3. `tools/node24-linux-protocol-qualification.mjs` runs bounded localhost
   HTTP/1.1, raw HTTP/2, and TLS 1.2 probes.
4. `tools/node24-package-smoke.mjs` packs the real package, asserts its five
   files, installs it in a clean temporary project, verifies version 3.0.6,
   starts an installed server, fetches a static file, and shuts it down.
5. Available verifier and protocol JSON reports are uploaded for review.

## Protocol result vocabulary

- `FIXED`: Node 24.22.2 produced the RFC-required result.
- `KNOWN`: the exact documented upstream limitation was reproduced. This is
  reported but does not fail qualification by itself; it is not conformance.
- `FAIL`: neither the required result nor the documented limitation occurred,
  or a control failed. The workflow fails.

This makes unexpected regressions visible without disguising known upstream
defects as successes. The JSON report includes runtime library versions and
every observation.

## Running manually

After a separately approved commit, push, and integration into default-branch
`master`:

1. Open the repository's **Actions** page.
2. Select **Node 24 Linux qualification**.
3. Choose **Run workflow** on `master` (or another ref that also contains the
   workflow after it is registered from `master`).
4. Verify the runtime step prints `v24.22.2`.

The workflow is `workflow_dispatch` only. GitHub requires a manually
dispatched workflow file to exist on the default branch before it is listed or
dispatchable; pushing it only to a feature branch is insufficient. A
repository user with Actions permission must trigger it after integration.

On a local Linux host already using Node.js 24.22.2, run:

```sh
set -euo pipefail
test "$(node --version)" = "v24.22.2"
npm ci
node tests/run-verifiers.js --report node24-linux-verifier-results.md
node tools/node24-linux-protocol-qualification.mjs
node tools/node24-package-smoke.mjs
```

## Passing the release gate

Adoption requires all 37 suites to pass without unexpected skips, zero
protocol `FAIL` results, the exact five package files, a successful clean
install/server smoke test, and review of Linux OpenSSL/nghttp2/TLS observations
against Windows. Every `KNOWN` result remains listed in the upgrade decision.

Prerequisites are GitHub-hosted `ubuntu-latest`, access for `setup-node` to
download 24.22.2, npm access for the locked development dependency, and user
approval to commit, push, integrate the workflow into `master`, and manually
run it. No npm or repository write permission is requested by the workflow.

# Node.js 24.22.2 Runtime Adoption Decision

> **Release status (Achieve 3.1.0):** This proposed runtime profile was adopted.
> Achieve 3.1.0 requires Node.js 24, Node.js 24.22.2 is the specifically
> qualified runtime, and the authoritative V3 ledger now records the four
> supported reclassifications. Final Linux qualification run 42049611849
> passed all 37 suites, the bounded protocol matrix, and package smoke testing.
> Statements below describing the ledger reconciliation as future work are
> retained as the historical decision record.

## Decision summary

Node.js 24.22.2 is a defensible preferred development and production runtime for Achieve. It passed the complete Achieve verifier on both Windows and Linux, passed package installation and startup smoke testing, and corrects four requirement-level HTTP/2 nonconformities observed with Node.js 22.15.0. It does not correct every upstream protocol limitation.

This report proposes a Node.js 24.22.2-specific conformance view. It does not change the authoritative V3 ledger, whose current classifications describe the tested Node.js 22.15.0 baseline and include two locally corrected Achieve behaviors that are not yet on GitHub `master`.

Recommended policy:

- Prefer Node.js 24.22.2 for Achieve development and production.
- Continue supporting Node.js 22 and later at the API and test-suite level for now.
- State explicitly that supported Node.js releases do not have identical protocol-conformance results.
- Do not raise `engines.node` or make Node.js 24 mandatory until the combined release candidate has passed the gates listed below and the minimum-runtime policy has been separately approved.

## Authoritative evidence

### Linux qualification on committed GitHub `master`

- GitHub Actions run: [42030975028](https://github.com/highlevellogic/achieve/actions/runs/42030975028)
- Tested commit: `edf852aa464f134ee9bf96f5ae3b20c5a4d58b1f`
- Artifact: `node24-linux-qualification-42030975028`
- Artifact digest: `sha256:97dfebcf3b0058d87728097fbb40f32c7255dc7dbfc02780d6a60796f9f386e4`
- Artifact files inspected:
  - `node24-linux-verifier-results.md`
  - `node24-linux-protocol-results.json`
- Runtime: Node.js 24.22.2, OpenSSL 3.5.9, nghttp2 1.70.0, llhttp 9.4.3, Linux x64.
- Complete verifier: 37 suites passed, 0 failed, 0 environmental skips.
- Protocol qualification: 13 observations, 6 `FIXED`, 7 `KNOWN`, 0 `FAIL`.
- Package qualification: tarball installation, installed-package startup, `GET /index.htm`, exact-body verification, and shutdown passed.

The artifact's contents, rather than the workflow conclusion alone, are the evidence used below.

### Windows qualification

The corresponding Windows evidence is recorded in:

- `node24-final-windows-evaluation.md`
- `http2-tls-renegotiation-investigation.md`
- `node-runtime-upgrade-evaluation.md`

On Node.js 24.22.2, the complete Windows verifier passed 37 suites with 0 failures. Six case-level symlink checks were skipped for the documented Windows environment limitation. The focused Windows probes established the same four full HTTP/2 corrections and the same principal remaining limitations as the Linux artifact.

### Evidence boundary

The Linux run tested committed GitHub `master` at `edf852aa464f134ee9bf96f5ae3b20c5a4d58b1f`. It did not include the uncommitted local Achieve corrections for:

- `V3-9110-086`, HTTP 205 response-content suppression; or
- `V3-9110-088`, matching `If-Range` single-part 206 metadata.

Those two requirements are classified Conformant in the current local V3 assessment based on their local implementation, focused four-transport regression evidence, and earlier local aggregate validation. The Linux artifact ran the older committed `response_completion` and `byte_ranges` tests and therefore does not independently validate the new implementations or their new regression cases.

## Protocol-observation reconciliation

The qualification script reports observations, not requirement records. Multiple observations can support one requirement, and one observation can affect a composite requirement. Therefore, six `FIXED` observations do not imply six V3 reclassifications.

| Linux observation | Result | V3 requirement(s) | Node.js 24.22.2 recommendation | Reconciliation with Windows evidence |
|---|---:|---|---|---|
| Excessive HTTP/1.1 request-target | `KNOWN`; 431 | `V3-9112-006` | Remain Nonconformant | Same as Windows. The shared parser overflow still does not yield the required 414 for the demonstrated request-target case. |
| Unknown HTTP/1.1 transfer coding | `KNOWN`; request accepted as 200 and body delivered | `V3-9112-017` | Remain Nonconformant | Same as Windows. Node/llhttp still accepts the demonstrated unsupported transfer coding. |
| HTTP/2 CONNECT rejected with 405 but no `Allow` | `KNOWN` | `V3-9110-098` | Remain Nonconformant | Same as Windows. The generated response contains `:status: 405` and `date`, but no `Allow`. |
| Client uses an even-numbered stream | `FIXED`; GOAWAY `PROTOCOL_ERROR` | `V3-9113-008` | Reclassify to Conformant for the Node.js 24.22.2 profile | Same corrected error code on Windows and Linux. |
| `SETTINGS_ENABLE_PUSH = 2` | `FIXED`; GOAWAY `PROTOCOL_ERROR` | `V3-9113-019` | Reclassify to Conformant for the Node.js 24.22.2 profile | One of two direct invalid-value controls for the same requirement. |
| `SETTINGS_MAX_FRAME_SIZE = 16383` | `FIXED`; GOAWAY `PROTOCOL_ERROR` | `V3-9113-019` | Supports the same reclassification; do not count separately | Same result on Windows and Linux. The bounded probes establish the formerly failing defined-range cases, not a proof over every possible parser input. |
| Client sends `PUSH_PROMISE` | `FIXED`; GOAWAY `PROTOCOL_ERROR` | `V3-9113-020` | Reclassify to Conformant for the Node.js 24.22.2 profile | Same corrected result on Windows and Linux. |
| Connection-level `WINDOW_UPDATE(0)` | `FIXED`; GOAWAY `PROTOCOL_ERROR` | `V3-9113-026` | Partial correction only; remain Nonconformant | The connection-scoped case is corrected, but the stream-scoped case below is not. |
| Stream-level `WINDOW_UPDATE(0)` | `KNOWN`; connection GOAWAY `PROTOCOL_ERROR` | `V3-9113-015`, `V3-9113-026`, and composite `V3-9113-007` | Remain Nonconformant | Same wrong connection scope on Windows and Linux; the required stream-scoped handling is not provided. |
| Exceed advertised concurrent-stream limit | `KNOWN`; connection GOAWAY `PROTOCOL_ERROR` | `V3-9113-012` and composite `V3-9113-007` | Remain Nonconformant | Error code improved relative to Node.js 22.15.0, but the demonstrated connection-level scope remains wrong. |
| Active connection flow-control-window overflow | `FIXED`; GOAWAY `FLOW_CONTROL_ERROR` | `V3-9113-029` | Reclassify to Conformant for the Node.js 24.22.2 profile | Same corrected error code on Windows and Linux. |
| TLS 1.2 post-preface renegotiation | `KNOWN`; renegotiation disabled, subsequent PING unacknowledged, no compliant GOAWAY observed | `V3-9113-053`; also evidence for `V3-9113-062` | Keep `V3-9113-053` Nonconformant; retain `V3-9113-062` Conformant | Both platforms reject renegotiation with `ERR_TLS_RENEGOTIATION_DISABLED`, but do not produce the required HTTP/2 connection error behavior. This corrects the earlier probe-interpretation claim that renegotiation had succeeded. |
| Prohibited TLS 1.2 cipher accepted for HTTP/2 | `KNOWN`; `TLS_RSA_WITH_AES_128_CBC_SHA` with ALPN `h2` | `V3-9113-056`; contrasted with `V3-9113-061` | Keep `V3-9113-056` Nonconformant; retain `V3-9113-061` Conformant | Same as Windows. Supporting mandatory cipher/P-256 capability does not excuse accepting a prohibited cipher. |

## Requirement-level classification recommendations

For a Node.js 24.22.2 runtime profile, four records can move from Nonconformant to Conformant:

1. `V3-9113-008` — client-initiated even-numbered stream handling.
2. `V3-9113-019` — invalid HTTP/2 SETTINGS values. The two `FIXED` SETTINGS observations are evidence for this single requirement.
3. `V3-9113-020` — receipt of client `PUSH_PROMISE`.
4. `V3-9113-029` — connection flow-control-window overflow error code.

The following nine records remain Nonconformant under Node.js 24.22.2:

- `V3-9110-098`
- `V3-9112-006`
- `V3-9112-017`
- `V3-9113-007`
- `V3-9113-012`
- `V3-9113-015`
- `V3-9113-026`
- `V3-9113-053`
- `V3-9113-056`

`V3-9113-026` illustrates why observation counts cannot be substituted for requirement counts: its connection-level case is fixed, but its stream-level case remains nonconformant. `V3-9113-007` remains nonconformant because it is an explicitly documented composite affected by the still-wrong error scope in the stream-state cases.

No Linux observation supplies new evidence that changes the eight Unverified, 22 Not applicable, or nine Optional not implemented records.

## Proposed Node.js 24.22.2 conformance totals

Starting from the corrected local V3 baseline:

| Classification | Current Node.js 22.15.0-oriented baseline | Proposed Node.js 24.22.2 profile | Change |
|---|---:|---:|---:|
| Conformant | 159 | 163 | +4 |
| Nonconformant | 13 | 9 | -4 |
| Unverified | 8 | 8 | 0 |
| Not applicable | 22 | 22 | 0 |
| Optional not implemented | 9 | 9 | 0 |
| **Total** | **211** | **211** | **0** |

These are proposed runtime-profile totals, not edits to the authoritative ledger. They include the two locally corrected Achieve requirements, `V3-9110-086` and `V3-9110-088`. Consequently, the totals describe the intended combined state, not the exact source tree tested by GitHub run 42030975028.

If only the committed `master` source at `edf852aa464f134ee9bf96f5ae3b20c5a4d58b1f` is considered, the local 205 and `If-Range` corrections cannot be credited from that run. A master-only total should not be presented without first restoring the pre-correction classifications for those two records or testing an integrated release candidate.

## Remaining upstream limitations

Node.js 24.22.2 still exhibits the following externally implemented limitations in the tested configurations:

- HTTP/1.1 request-target overflow produces 431 instead of the required 414 in the demonstrated shared-parser-limit case.
- An unsupported transfer coding is accepted in the demonstrated request.
- Node-generated HTTP/2 CONNECT rejection uses 405 without `Allow`.
- Stream-level `WINDOW_UPDATE(0)` produces a connection error rather than the required stream error.
- Exceeding the advertised concurrent-stream limit produces a connection error rather than the required stream treatment.
- Post-preface TLS 1.2 renegotiation is disabled, but the required HTTP/2 connection error and closure behavior was not observed.
- A prohibited TLS 1.2 cipher can still negotiate HTTP/2.

These are reasons to retain the nine Nonconformant classifications above. They are not Achieve API regressions, and the bounded qualification found no new Achieve compatibility failure.

## Runtime-support policy

### Preferred runtime

Adopt Node.js 24.22.2 as the preferred development and production runtime after the combined release-candidate gates pass. The recommendation is supported by:

- complete Windows and Linux verifier success;
- package installation and runtime smoke success on Linux;
- consistent cross-platform protocol observations;
- four fully corrected requirement-level HTTP/2 findings; and
- no identified Achieve compatibility regression.

Pin qualification and release validation to the exact tested patch, 24.22.2. A later Node.js 24 patch should be requalified rather than assumed identical because Node, nghttp2, llhttp, and OpenSSL behavior can change independently.

### Continued Node.js 22 support

Node.js 22 and later can remain supported for Achieve's public API and ordinary operation. Existing validation establishes compatibility on the tested Node.js 22 baseline, and no Achieve code change currently requires Node.js 24.

Documentation should distinguish compatibility support from the preferred conformance profile:

- Node.js 24.22.2 is the preferred and fully qualified runtime.
- Node.js 22 remains supported, but the tested 22.15.0 stack has four additional HTTP/2 requirement-level defects that are corrected by 24.22.2.
- A current maintained Node.js 22 patch should be run through the same bounded qualification before making claims about all Node.js 22 releases; results from 22.15.0 must not be generalized to every 22.x patch.

No `engines.node` change is justified solely by this assessment. Raising the minimum would be a release-policy decision, not a prerequisite for recommending Node.js 24.

## Final release-candidate verification gates

Before adopting the policy in release documentation or changing the authoritative ledger:

1. Integrate the HTTP 205 and matching `If-Range` corrections into a clean candidate based on the intended release commit.
2. Run all 37 suites on that exact candidate with Node.js 24.22.2 on Windows and Ubuntu.
3. Confirm zero Linux environmental skips and record any expected Windows case-level skips.
4. Run the focused four-transport 205 and byte-range/conditional regression tests from the integrated candidate.
5. Run the 13-observation protocol qualification unchanged and require no `FAIL` observations; preserve the exact `FIXED`/`KNOWN` accounting.
6. Run `npm pack`, install the actual candidate tarball into a clean project, and repeat startup, exact HTTP response, and clean-shutdown smoke testing.
7. Verify package contents and ensure no qualification or review files enter the npm package unexpectedly.
8. Reconcile the authoritative V3 ledger explicitly to a named runtime profile before changing classifications; do not silently replace the Node.js 22.15.0 evidence baseline.
9. Add or retain CI coverage for the supported Node.js 22 line, preferably using a currently maintained 22.x patch, alongside the exact Node.js 24.22.2 qualification.
10. Document the preferred-runtime recommendation, tested component versions, remaining upstream limitations, and the distinction between support and preferred conformance.

## Conclusion

The Linux evidence closes the final platform qualification gate for Node.js 24.22.2 as a runtime candidate. Together with the Windows results, it supports recommending Node.js 24.22.2 as Achieve's preferred development and production runtime. Adoption should wait only for validation of the combined candidate containing the two uncommitted Achieve conformance corrections and for an explicit runtime-support documentation decision. Node.js 22 can remain supported without implying that its tested protocol behavior is identical to Node.js 24.22.2.

# Node.js runtime upgrade evaluation for Achieve 3.0.6

## Executive conclusion

Node.js 24 is the appropriate release line to continue evaluating, but the
installed Node.js 24.22.1 binary is **not yet a defensible production upgrade
for Achieve**. It passed all 37 Achieve verifier suites and corrects several
HTTP/2 error-code defects present in Node.js 22.15.0. However, a focused TLS
1.2 probe found a material regression: post-preface renegotiation remained
open and completed without an error on Node.js 24.22.1, whereas Node.js
22.15.0 rejected it (albeit with the wrong HTTP/2 error code). That observation
conflicts with RFC 9113 section 9.2.1 and with the currently assessed
renegotiation-disablement behavior.

Node.js 24 is an LTS line supported through April 2028, while Node.js 22 is an
older LTS line. The installed 24.22.1 binary is also not the latest 24.x patch
visible in the official release history. Before adoption, the TLS observation
must be reproduced on the latest supported 24.x binary and on Linux, and the
remaining raw-protocol gates listed below must pass. No package metadata or
runtime requirement should change based on this evaluation alone.

## Environment and versions

Achieve's `package.json` currently declares `node >=22`. The normal project
runtime on this Windows host is Node.js 22.15.0. One newer independent runtime
was already installed in the Codex runtime cache; no runtimes were downloaded
or installed for this evaluation.

| Component | Current project runtime | Candidate runtime |
|---|---:|---:|
| Node.js | 22.15.0 | 24.22.1 |
| Status | LTS release line | LTS release line |
| llhttp | 9.2.1 | 9.4.3 |
| nghttp2 | 1.64.0 | 1.70.0 |
| OpenSSL | 3.0.16 | 3.5.9 |
| libuv | 1.49.2 | 1.52.1 |
| V8 | 12.4.254.21-node.24 | 13.6.233.17-node.58 |

Official release-line references:

- [Node.js previous releases](https://nodejs.org/en/about/previous-releases)
  identifies the supported LTS lines and recommends Active or Maintenance LTS
  releases for production.
- [Migrating from Node.js 22 to 24](https://nodejs.org/en/blog/migrations/v22-to-v24)
  records Node.js 24's LTS transition and support through April 2028.
- [Node.js 24.22.1 release](https://nodejs.org/en/blog/release/v24.22.1)
  identifies the installed candidate as a security release.
- The [Node.js changelog](https://github.com/nodejs/node/blob/main/CHANGELOG.md)
  lists later patches than the installed 24.22.1 binary; those binaries were
  not available locally and were not installed.

The version comparison is about the exact binaries tested, not every release
on either major line.

## Method

The evaluation combined:

1. the existing standalone-Node and Achieve raw-frame investigations;
2. fresh bounded standalone probes under both installed executables for HTTP/1
   parsing, HTTP/2 CONNECT, active-stream limits, active flow-control-window
   overflow, TLS renegotiation, and prohibited TLS 1.2 cipher negotiation; and
3. the complete established Achieve verifier under each runtime.

Achieve was compared directly with standalone Node in the prior investigations
where the behavior occurs before application dispatch. Fresh standalone probes
were sufficient to determine whether the candidate runtime changed those same
delegated parser, compatibility-layer, nghttp2, and OpenSSL paths. The existing
Achieve evidence remains the endpoint control for Node.js 22.15.0.

Raw HTTP/2 probes deliberately used valid frame encoding and controlled stream
state. Relevant cases were also previously repeated with fragmented TCP
delivery, so a changed result is not attributed merely to packet boundaries.

## Remaining 13 nonconformities and runtime sensitivity

The current ledger contains these 13 Nonconformant records. The table reports
what the tested Node.js 24.22.1 runtime changes; it does not alter the ledger,
which assesses Achieve 3.0.6 on Node.js 22.15.0.

| ID | Requirement / Node 22.15.0 result | Node 24.22.1 result | Upgrade effect |
|---|---|---|---|
| `V3-9110-098` | RFC 9110 §15.5.6: generated 405 lacks `Allow` for classic HTTP/2 CONNECT. | Same: handler not invoked; response contains only `:status 405` and `date`. | Unresolved. |
| `V3-9112-006` | RFC 9112 §3: overlong request-target receives 431, not 414. | Same shared `HPE_HEADER_OVERFLOW`; 431. | Unresolved. |
| `V3-9112-017` | RFC 9112 §6.1 SHOULD: unknown non-final request transfer coding is accepted instead of receiving 501. | Same: `frobnicate, chunked` receives 200 and application sees decoded chunk payload `Wiki`. | Unresolved. |
| `V3-9113-007` | RFC 9113 §5.1 composite state/error record has several demonstrated counterexamples. | Some narrower causes are fixed, but excess-stream and stream `WINDOW_UPDATE(0)` defects remain. | Remains Nonconformant as the umbrella record. |
| `V3-9113-008` | §5.1.1 even client stream receives `GOAWAY(INTERNAL_ERROR)`. | Existing direct comparison receives required `GOAWAY(PROTOCOL_ERROR)`. | Demonstrated runtime fix. |
| `V3-9113-012` | §5.1.2 stream exceeding advertised concurrency limit receives connection `GOAWAY(INTERNAL_ERROR)`. | Fresh held-stream probe receives connection `GOAWAY(PROTOCOL_ERROR)`, still not the required stream error (`PROTOCOL_ERROR` or `REFUSED_STREAM`). | Code changes; scope defect remains. |
| `V3-9113-015` | §5.4.2 open-stream `WINDOW_UPDATE(0)` receives GOAWAY instead of RST_STREAM. | Existing Node 24 comparison has the same connection-scope response. | Unresolved. |
| `V3-9113-019` | §6.5.2 invalid SETTINGS values receive wrong `INTERNAL_ERROR`. | Existing direct comparison receives required codes for the tested invalid values. | Demonstrated runtime fix for tested cases. |
| `V3-9113-020` | §6.6 client PUSH_PROMISE receives wrong `INTERNAL_ERROR`. | Existing direct comparison receives required `PROTOCOL_ERROR`. | Demonstrated runtime fix. |
| `V3-9113-026` | §6.9 zero WINDOW_UPDATE increment has wrong code/scope. | Connection increment zero is fixed to `PROTOCOL_ERROR`; open-stream increment zero still causes connection GOAWAY instead of stream RST_STREAM. | Partly fixed; record remains Nonconformant. |
| `V3-9113-029` | §6.9.2 active-window overflow receives stream `RST_STREAM(FLOW_CONTROL_ERROR)`. | Fresh controlled probe receives required connection `GOAWAY(FLOW_CONTROL_ERROR)`. | Demonstrated runtime fix. |
| `V3-9113-053` | §9.2.1 post-preface TLS 1.2 renegotiation is rejected with wrong `GOAWAY(INTERNAL_ERROR)`. | Fresh probe observed no GOAWAY, no TLS error, and an open connection after renegotiation completed. | Not fixed; candidate introduces a more serious behavior. |
| `V3-9113-056` | §9.2.2 SHOULD NOT negotiate a prohibited TLS 1.2 cipher when explicitly weakened. | Same: TLS 1.2 + ALPN `h2` negotiated `TLS_RSA_WITH_AES_128_CBC_SHA` and exchanged SETTINGS. | Unresolved policy issue. |

### HTTP/2 connection and stream error behavior

The existing five-findings comparison established that Node.js 24.22.1
corrected a broad Node.js error-code substitution: invalid stream parity,
invalid tested SETTINGS values, client PUSH_PROMISE, and connection-scoped
`WINDOW_UPDATE(0)` changed from `INTERNAL_ERROR` to the required
`PROTOCOL_ERROR`. That upstream correction is present in the tested binary;
it was not inferred from source history.

Two fresh stateful tests add the following:

- With `MAX_CONCURRENT_STREAMS=1`, stream 1 deliberately held open, and stream
  3 newly opened, Node 22 sent connection `GOAWAY(INTERNAL_ERROR)` and Node 24
  sent connection `GOAWAY(PROTOCOL_ERROR)`. Both are the wrong scope; the
  required response is a stream error. This leaves `V3-9113-012` unresolved.
- With an active stream window set to zero, incremented to one, then adjusted
  by changing `SETTINGS_INITIAL_WINDOW_SIZE` to `2^31-1`, Node 22 sent stream
  `RST_STREAM(FLOW_CONTROL_ERROR)`. Node 24 sent the required connection
  `GOAWAY(FLOW_CONTROL_ERROR)`. This resolves the demonstrated candidate
  behavior behind `V3-9113-029`.

The stream-scoped `WINDOW_UPDATE(0)` defect remains in Node 24.22.1: the peer
receives connection GOAWAY rather than stream RST_STREAM. Consequently the
generic stream-error obligation (`V3-9113-015`), the zero-increment obligation
(`V3-9113-026`), and the composite state-machine record (`V3-9113-007`) remain
failed even after the candidate's connection-level error-code fixes.

### HTTP/1.1 request parsing

A 20,001-character request-target with otherwise small fields produced
`HPE_HEADER_OVERFLOW` and HTTP 431 on both runtimes. In both cases the parser
reported `bytesParsed=20005`; the supported error boundary still does not
distinguish request-target overflow from field-section overflow. Node 24.22.1
therefore does not resolve the RFC 9112 §3 414 requirement.

For `Transfer-Encoding: frobnicate, chunked`, both runtimes returned 200 and
delivered `Wiki` to the handler after removing chunk framing. The candidate
does not implement RFC 9112 §6.1's recommended 501 response for an unknown
request transfer coding.

### HTTP/2 CONNECT 405

On both runtimes, a valid classic CONNECT caused Node's HTTP/2 compatibility
layer to generate 405 before invoking the request handler. The response fields
were `:status: 405` and `date`; `allow` was absent. The candidate therefore
does not resolve `V3-9110-098`.

### TLS behavior

Both tests forced TLS 1.2 with ALPN `h2`; this avoids confusing TLS 1.3, where
renegotiation does not apply, with the RFC 9113 TLS 1.2 obligation.

- Node 22.15.0 rejected post-preface renegotiation and sent
  `GOAWAY(INTERNAL_ERROR)`, reproducing the existing finding: rejection occurs,
  but the mandatory HTTP/2 code is wrong.
- Node 24.22.1 accepted the same renegotiation attempt. After 1.5 seconds the
  TLS socket remained open, the callback reported no error, and no GOAWAY was
  observed. The negotiated allowed cipher remained
  `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`.

This Node 24 result would not merely leave `V3-9113-053` unresolved. It would
also invalidate the current-runtime evidence for `V3-9113-062` (TLS 1.2
renegotiation disabled) in the candidate configuration. It is therefore an
upgrade blocker until reproduced and understood on the latest 24.x patch and
on another platform. Likely responsibility lies in the Node/OpenSSL HTTP/2
integration, but this evaluation does not assign a root cause from one binary
comparison.

With both peers explicitly configured for
`AES128-SHA:@SECLEVEL=0`, each runtime negotiated the prohibited
`TLS_RSA_WITH_AES_128_CBC_SHA` suite with ALPN `h2` and exchanged SETTINGS.
The upgrade does not replace Achieve's need for a deliberate TLS policy
decision for `V3-9113-056`.

## Achieve verifier compatibility

| Runtime | Suites discovered | Passed | Failed | Declared case-level skips | Duration |
|---|---:|---:|---:|---:|---:|
| Node 22.15.0 | 37 | 37 | 0 | 6 | 38.924 s |
| Node 24.22.1 | 37 | 37 | 0 | 6 | 35.469 s |

The six skips are the established Windows symlink/`EPERM` cases in the
physical-containment verifier. No new suite failure or skip appeared under
Node 24.

These runs used the current working tree, which includes the already reviewed
but uncommitted HTTP 205 and matching-If-Range corrections. They establish
runtime compatibility for that exact tree, not a pristine npm-installed copy
of 3.0.6. The raw protocol tests remain necessary because the aggregate suite
does not cover every RFC error code, scope, or TLS renegotiation condition.

## Compatibility assessment

### Benefits demonstrated in Node 24.22.1

- All 37 project suites pass.
- Correct HTTP/2 codes are emitted for the tested invalid stream parity,
  invalid SETTINGS, client PUSH_PROMISE, and connection WINDOW_UPDATE(0)
  cases.
- Active-stream initial-window overflow now has the correct connection scope
  and `FLOW_CONTROL_ERROR` code.
- The line has a longer remaining LTS support horizon than Node 22.

### Unresolved defects

- Request-target overflow still yields 431 rather than 414.
- Unknown non-final request transfer coding is still accepted.
- HTTP/2 CONNECT-generated 405 still omits `Allow`.
- Excess concurrent streams and stream WINDOW_UPDATE(0) still use the wrong
  error scope.
- Explicitly weakened TLS configuration still permits an HTTP/2-prohibited
  TLS 1.2 cipher.

### Candidate regression / blocker

The tested Node 24.22.1 binary accepted post-preface TLS 1.2 renegotiation.
The aggregate suite does not detect this. Until the result is independently
reproduced on the latest patch and Linux, changing Achieve's documented or
packaged runtime baseline to Node 24 would trade several protocol corrections
for a TLS requirement regression.

## Recommendation and required follow-up

**Recommendation: retain the current `>=22` requirement for now and do not
adopt Node 24.22.1 as Achieve's recommended production runtime. Continue with
the Node 24 LTS line as the preferred upgrade candidate.**

Before adoption:

1. Obtain the latest supported Node 24 patch through the normal environment
   management process; do not standardize on the already superseded 24.22.1
   binary.
2. Reproduce the post-preface TLS 1.2 renegotiation test on that exact Windows
   binary and on Linux, recording GOAWAY, TLS errors, socket closure, OpenSSL,
   and nghttp2 versions. Adoption requires rejection and the RFC-required
   connection `PROTOCOL_ERROR`.
3. Run all 37 verifier suites on Windows and Linux under the chosen binary.
4. Repeat the raw upgrade gates: invalid parity; invalid SETTINGS boundaries;
   client PUSH_PROMISE; connection and open-stream WINDOW_UPDATE(0); held-open
   concurrent-stream excess; active-window overflow; CONNECT 405 fields;
   overlong request-target; unknown transfer coding; and allowed/prohibited
   TLS 1.2 cipher controls.
5. Add a permanent TLS renegotiation regression test before changing the
   recommended runtime, because the present aggregate suite missed the
   candidate regression.
6. Treat remaining parser/nghttp2 defects as upstream issues rather than
   introducing a second HTTP parser or HTTP/2 state machine into Achieve.

If a current Node 24 patch rejects renegotiation correctly and the cross-
platform gates pass, Node 24 is a defensible upgrade candidate: it materially
improves demonstrated HTTP/2 conformance without changing Achieve's public API.
This report intentionally makes no V3 classification changes; those require a
separate assessment against the exact adopted runtime configuration.

## Investigation limits

- Only Node.js 22.15.0 and 24.22.1 were installed locally.
- The fresh raw probes were standalone Node probes for behavior delegated by
  Achieve before ordinary application dispatch. Existing Achieve probes supply
  the matching Node 22 endpoint observations; a final adoption gate should
  repeat every case through both standalone Node and Achieve on the selected
  binary.
- Cleartext and secure variants were not freshly repeated for every raw-frame
  case. Prior focused investigations found the compared state-machine results
  independent of transport and TCP fragmentation, but release adoption should
  retain both variants.
- No conformance classification, implementation, dependency, package
  metadata, or runtime requirement was changed.

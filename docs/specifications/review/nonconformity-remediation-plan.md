# Achieve 3.1.0 HTTP Nonconformity Remediation Plan

## Executive summary

The corrected V3 inventory contains 211 requirements. Nine are classified
**Nonconformant**: seven mandatory (`MUST` or `MUST NOT`) obligations and two
recommendations (`SHOULD` or `SHOULD NOT`). The 15 requirement-level findings
from the original plan were not 15 independent defects; `V3-9110-086` and
`V3-9110-088` were corrected in Achieve, while `V3-9113-008`, `019`, `020`,
and `029` were corrected by adopting the qualified Node.js 24.22.2 runtime.
Several HTTP/2 records describe distinct
RFC obligations affected by the same Node.js/nghttp2 error-selection or
error-scope behavior.

The two bounded Achieve response-generation findings are corrected. The 205
correction suppresses managed and application-owned response content while
preserving Node's native validation and lifecycle behavior. The `If-Range`
correction omits redundant representation metadata only on a successful
single-part 206. Both have focused four-transport regression coverage and pass
the complete 37-suite aggregate.

One TLS recommendation (`V3-9113-056`) could be enforced by Achieve, but doing
so would change the current pass-through treatment of application-supplied TLS
options and needs an explicit compatibility-policy decision. The remaining
findings arise in Node.js, nghttp2, or OpenSSL before or below Achieve's request
handler. They should not be "fixed" by adding a second HTTP parser or HTTP/2
framing layer to Achieve.

Achieve 3.1.0 adopts Node.js 24 as its minimum runtime; Node.js 24.22.2 is the
qualified baseline. Final Linux qualification run 42049611849 passed all 37
suites, package installation/startup smoke testing, and the bounded protocol
matrix. It confirmed the four runtime-layer corrections above while retaining
the remaining nine findings. Earlier Node.js 22.15.0 results remain historical
evidence of the corrected runtime behavior.

## Decision table, including resolved findings

Evidence report names below are relative to this review directory. RFC links
point to the official RFC Editor HTML editions.

| ID | Obligation and level | Observed behavior and reproduction | Layer / newer-runtime status | Achieve remedy and recommended action | Priority |
|---|---|---|---|---|---|
| `V3-9110-086` | [RFC 9110 §15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6): a server **MUST NOT** generate content in a 205 response. | **Resolved.** Managed and application-owned string, Buffer, Uint8Array, Promise, write/end/writeHead/flushHeaders, invalid-chunk, lifecycle, callback, and connection-reuse cases pass over all four transports. | Achieve's servlet response boundary replaces supported content with empty content and invokes the native Node methods, preserving validation and lifecycle behavior. | Reclassified **Conformant**. Retain the focused response-completion regressions. | **Complete** |
| `V3-9110-088` | [RFC 9110 §15.3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7): for a 206 sent in response to `If-Range`, a sender **SHOULD NOT** repeat representation fields beyond the required set. | **Resolved.** Matching strong `If-Range` responses omit `Content-Type` and `Last-Modified` while retaining Date, current strong ETag, Content-Range, partial Content-Length, Accept-Ranges, Server, and exact range bytes. Ordinary 206 and false-condition 200 metadata remain unchanged. | Achieve static/media response-header selection. The byte-range verifier passes over HTTP, HTTPS, h2c, and secure HTTP/2. | Reclassified **Conformant**. Retain exact-header, validator, partial-byte, ordinary-range, nonmatching-tag, and conservative date-form regressions. | **Complete** |
| `V3-9110-098` | [RFC 9110 §15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): an origin server generating 405 **MUST** generate `Allow` with the target resource's currently supported methods. | Final Node 24.22.2 qualification confirms that valid classic HTTP/2 CONNECT receives `:status 405` and `date`, but no `allow`; Node does not invoke the compatibility request handler. | Node.js 24.22.2 HTTP/2 compatibility layer. | **No safe ordinary-handler fix.** Report upstream with the minimal standalone Node case. An Achieve workaround would require lower-level stream interception and exact method computation before Node's compatibility response; adopt only if Node cannot correct it and lifecycle/double-response risks are resolved. | **P1 upstream** |
| `V3-9112-006` | [RFC 9112 §3](https://www.rfc-editor.org/rfc/rfc9112.html#section-3): a server receiving a request-target longer than it wishes to parse **MUST** respond 414. | A raw request with a 20,001-character target received 431 and connection close. The focused H105 investigation reproduced the shared `HPE_HEADER_OVERFLOW` path on Node 22.15.0 and 24.22.1. | Node HTTP/1.1 parser. Not fixed in tested Node 24.22.1. Historical Node issue/PR work introduced generic 431 handling but not target/field differentiation. | **Do not add a second parser.** Prepare an upstream Node issue using the existing standalone reproduction and request a supported distinction between request-line/target overflow and field-section overflow. Document the runtime limitation until upstream support exists. | **P1 upstream** |
| `V3-9112-017` | [RFC 9112 §6.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.1): a server receiving an unrecognized request transfer coding **SHOULD** respond 501. | Final Node 24.22.2 qualification sends `Transfer-Encoding: frobnicate, chunked`; Node and Achieve return 200, remove chunk framing, and deliver the still-frobnicate-coded bytes to the application. | Node.js 24.22.2 HTTP/1.1 parser. | Report upstream if no existing issue covers it. Achieve lacks a supported parser signal identifying the unknown non-final coding; a second parser is not justified for this SHOULD-level issue. Consider defensive documentation only while unresolved. | **P2 upstream** |
| `V3-9113-007` | [RFC 9113 §5.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1): an endpoint **MUST** enforce state-dependent frame permissions and the specified stream or connection errors. This is an intentionally retained composite record. | P-series probes and the five-findings investigation produced multiple wrong code/scope outcomes before Achieve dispatch, including Node 22 `INTERNAL_ERROR` substitutions and the stream `WINDOW_UPDATE(0)` scope failure. Whole and fragmented delivery agreed. | Node.js/nghttp2. Node 24.22.1 corrected tested connection-level substitutions, but not stream-scoped `WINDOW_UPDATE(0)`. | Treat this as an umbrella release gate, not a separate code change. Resolve and retest its narrower causes (`008`, `012`, `015`, `019`, `020`, `026`, and `029`). Do not claim this composite fully conformant until all applicable demonstrated counterexamples are gone. | **P1 umbrella** |
| `V3-9113-008` | [RFC 9113 §5.1.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.1): new client-initiated streams use odd identifiers; invalid parity is a connection error of type `PROTOCOL_ERROR` (**MUST**). | **Resolved by runtime adoption.** Node 22.15.0 historically produced `GOAWAY(INTERNAL_ERROR)`; final Node 24.22.2 qualification produces the required connection `GOAWAY(PROTOCOL_ERROR)`. | Node.js/nghttp2 runtime layer. | Reclassified **Conformant** for Achieve 3.1.0 / Node.js 24.22.2. Retain the raw-frame parity probe as a runtime-upgrade gate. | **Complete** |
| `V3-9113-012` | [RFC 9113 §5.1.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.2): a newly opened stream exceeding the advertised concurrent-stream limit **MUST** receive the specified stream error (`PROTOCOL_ERROR` or `REFUSED_STREAM`). | Final Node 24.22.2 qualification advertises one stream, holds stream 1 open, then opens stream 3; the endpoint sends connection `GOAWAY(PROTOCOL_ERROR)`, not a stream error. | Node.js 24.22.2/nghttp2 1.70.0. | Report upstream with explicit stream-lifetime controls. No safe Achieve handler fix because the rejection occurs in the HTTP/2 state machine. | **P1 upstream** |
| `V3-9113-015` | [RFC 9113 §5.4.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.4.2): an endpoint detecting a stream error **MUST** send `RST_STREAM` with the applicable code, subject to closed-stream exceptions. | An open nonzero stream receiving `WINDOW_UPDATE(0)` caused connection `GOAWAY` rather than `RST_STREAM`; open-stream controls removed the application-response race. | nghttp2/Node. The scope defect persisted on Node 24.22.1. Same underlying defect as `V3-9113-026`, but a distinct RFC obligation. | Prepare one upstream report grouped with `V3-9113-026`, clearly separating the §5.4.2 stream-error framing obligation from §6.9's zero-increment rule. No Achieve workaround. | **P1 upstream** |
| `V3-9113-019` | [RFC 9113 §6.5.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.5.2): a recipient **MUST** treat an out-of-range SETTINGS value as the specified connection error. | **Resolved by runtime adoption.** Node 22.15.0 historically produced `GOAWAY(INTERNAL_ERROR)`; final Node 24.22.2 qualification sends the required `GOAWAY(PROTOCOL_ERROR)` for both `SETTINGS_ENABLE_PUSH=2` and `SETTINGS_MAX_FRAME_SIZE=16383`. | Node.js/nghttp2 runtime layer. | Reclassified **Conformant** for the directly exercised defined-range cases. Preserve both probes and valid controls; do not infer every possible range from them. | **Complete** |
| `V3-9113-020` | [RFC 9113 §6.6](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.6): a server receiving PUSH_PROMISE **MUST** use connection `PROTOCOL_ERROR`. | **Resolved by runtime adoption.** Node 22.15.0 historically produced `GOAWAY(INTERNAL_ERROR)`; final Node 24.22.2 qualification produces the required connection `GOAWAY(PROTOCOL_ERROR)`. | Node.js/nghttp2 runtime layer. | Reclassified **Conformant** for Achieve 3.1.0 / Node.js 24.22.2. Preserve the direct client-PUSH_PROMISE probe. | **Complete** |
| `V3-9113-026` | [RFC 9113 §6.9](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.9): zero `WINDOW_UPDATE` increment is `PROTOCOL_ERROR` at the applicable scope (**MUST**). | Node 22 returned connection `INTERNAL_ERROR` for connection- and stream-scoped probes. Node 24 corrected the connection-level code, but an open nonzero stream still received connection `GOAWAY(PROTOCOL_ERROR)` instead of stream `RST_STREAM(PROTOCOL_ERROR)`. | Node.js/nghttp2. Partly fixed in Node 24.22.1; stream scope remains defective. | Upgrade removes only the connection-code facet. File/report the remaining nghttp2/Node stream-scope issue together with `V3-9113-015`. Retain deliberate open-stream and fragmented-delivery controls. | **P1 runtime + upstream** |
| `V3-9113-029` | [RFC 9113 §6.9.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.9.2): `SETTINGS_INITIAL_WINDOW_SIZE` changes **MUST** adjust active stream windows; overflow requires connection `FLOW_CONTROL_ERROR`. | **Resolved by runtime adoption.** Node 22.15.0 historically produced stream `RST_STREAM(FLOW_CONTROL_ERROR)`; final Node 24.22.2 qualification produces the required connection `GOAWAY(FLOW_CONTROL_ERROR)`. | Node.js/nghttp2 runtime layer. | Reclassified **Conformant** for the active-window overflow case and controls. Preserve the raw flow-control probe for future runtime changes. | **Complete** |
| `V3-9113-053` | [RFC 9113 §9.2.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2.1): after the client preface, TLS 1.2 renegotiation **MUST** be a connection error of type `PROTOCOL_ERROR` (apart from the pre-preface client-certificate exception). | Final Node 24.22.2 qualification confirms renegotiation is disabled with `ERR_TLS_RENEGOTIATION_DISABLED`, but no required `GOAWAY(PROTOCOL_ERROR)` is emitted and the post-attempt PING is not acknowledged. | Node.js 24.22.2, nghttp2 1.70.0, and OpenSSL 3.5.9 interaction. | Report upstream with the refined TLS 1.2 sequence and exact runtime versions. Do not weaken the separately conformant renegotiation-disablement record. | **P1 upstream** |
| `V3-9113-056` | [RFC 9113 §9.2.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2.2): a TLS 1.2 HTTP/2 endpoint **SHOULD NOT** negotiate a prohibited cipher suite. | Final Node 24.22.2 qualification confirms that explicitly configuring `TLS_RSA_WITH_AES_128_CBC_SHA` and lowering OpenSSL security permits TLS 1.2 with ALPN `h2`. Defaults are not implicated. | Application-supplied TLS policy passed through Achieve to Node.js 24.22.2/OpenSSL 3.5.9. | **Policy decision required.** Options are: reject prohibited TLS 1.2 suites for HTTP/2; filter them while preserving allowed suites; or retain pass-through behavior with a documented reason for the SHOULD-level departure. Any guard must preserve TLS 1.3, HTTPS-only configurations, and custom-cipher compatibility. | **P2 policy** |

## Root-cause groupings

These groups aid remediation but do not merge or retire any RFC record.

### 1. Achieve response-generation semantics

- `V3-9110-086`: resolved; status 205 content is suppressed at the servlet
  response boundary while native response semantics are retained.
- `V3-9110-088`: resolved; a successful `If-Range` single-part 206 omits
  redundant `Content-Type` and `Last-Modified` metadata.

The completed corrections remain tested separately because one is a content
prohibition and the other is a header-selection recommendation.

### 2. Node.js HTTP/1.1 parser limitations

- `V3-9112-006`: request-target and header-field overflow share
  `HPE_HEADER_OVERFLOW`, leading to 431 instead of 414.
- `V3-9112-017`: an unknown non-final transfer coding is not surfaced for a
  recommended 501 response.

Achieve receives neither case through an API that safely supports the required
distinction. A custom pre-parser would have to handle fragmented input,
pipelining, upgrades, persistent connections, and parser-limit synchronization;
that cost and risk are disproportionate.

### 3. Node.js HTTP/2 compatibility response generation

- `V3-9110-098`: Node generates classic CONNECT 405 before Achieve's
  compatibility handler and omits `Allow`.

Final Node 24.22.2 qualification confirms the finding. It should be raised
upstream; any Achieve stream-layer workaround needs a separate design review.

### 4. Resolved Node 22 HTTP/2 error-code and scope findings

- `V3-9113-008`, `V3-9113-019`, `V3-9113-020`, and `V3-9113-029` are
  corrected in the qualified Node 24.22.2 runtime and reclassified Conformant.
- The connection-level facet of `V3-9113-026` is also corrected there.
- `V3-9113-007` summarizes these and other state/error failures for retained V2
  traceability.

These historical Node 22 findings explain the runtime-driven classification
changes. The composite `007` remains Nonconformant because narrower state and
scope counterexamples remain; it must not be counted as an additional
independent root cause or used to imply exhaustive state-machine coverage.

### 5. Remaining nghttp2/Node stream-state and flow-control defects

- `V3-9113-012`: excess concurrent stream receives a connection error.
- `V3-9113-015` and `V3-9113-026`: zero-increment WINDOW_UPDATE on an open
  stream receives a connection error rather than a stream reset.
The `015` and stream facet of `026` are one demonstrated underlying defect but
violate two distinct normative obligations. `012` remains a distinct
concurrency-limit scope defect on Node 24.22.2.

### 6. TLS policy and TLS-to-HTTP/2 error mapping

- `V3-9113-053`: post-preface TLS 1.2 renegotiation is rejected with the wrong
  HTTP/2 error code.
- `V3-9113-056`: an explicitly weakened TLS 1.2 cipher policy can negotiate a
  prohibited suite.

The first is an upstream protocol-error mapping issue. The second is a product
policy question at Achieve's TLS-option boundary; it is not evidence that
Achieve's default cipher selection is unsafe.

## Achieve-local work candidates

### Completed implementation work

1. **HTTP 205 content suppression (`V3-9110-086`).** The response boundary
   suppresses managed and application-owned content while preserving native
   Node validation, lifecycle, callback, and connection-reuse behavior.
2. **If-Range 206 metadata (`V3-9110-088`).** The localized SHOULD-level
   correction omits only `Content-Type` and `Last-Modified` on a successful
   matching single-part 206. Ordinary range responses and full responses are
   unchanged.

### Possible work requiring explicit approval

3. **TLS 1.2 prohibited-cipher policy (`V3-9113-056`).** Achieve can inspect or
   constrain supplied cipher options, but this changes a public configuration
   boundary. Decide whether Achieve promises RFC 9113 policy enforcement even
   when an application explicitly lowers OpenSSL security settings.
4. **HTTP/2 CONNECT 405 interception (`V3-9110-098`).** Do not implement unless
   newer Node remains defective and a separate design proves that stream-level
   interception can add a correct `Allow` without duplicate handling or altered
   CONNECT semantics.

No Achieve-local workaround is recommended for the HTTP/1 parser findings or
HTTP/2 frame/state findings.

## Runtime-upgrade result

Achieve 3.1.0 requires Node.js 24; Node.js 24.22.2 is the specifically qualified
runtime. Windows and Linux executed the complete 37-suite verifier, and final
Linux run 42049611849 additionally exercised the bounded protocol matrix and
real package installation/startup smoke test. The upgrade resolves `008`,
`019`, `020`, and `029`, plus the connection-level facet of `026`. It does
not resolve `007`, `012`, `015`, the stream facet of `026`, `053`, `056`,
`098`, `9112-006`, or `9112-017`.

## Upstream reports worth preparing

No issue should be filed until duplicates and current supported releases are
checked. Suggested reports are:

1. **Node HTTP/1 request-target overflow:** 431 rather than required 414, with
   shared `HPE_HEADER_OVERFLOW`, fragmented/boundary cases, and the draft from
   `rfc9112-h105-node-investigation.md` (`V3-9112-006`).
2. **Node HTTP/1 unknown non-final transfer coding:** accepted request rather
   than recommended 501, with final-`chunked` and invalid-final controls
   (`V3-9112-017`).
3. **Node HTTP/2 classic CONNECT 405:** Node-generated 405 lacks mandatory
   `Allow` and bypasses the compatibility handler (`V3-9110-098`).
4. **nghttp2/Node stream `WINDOW_UPDATE(0)` scope:** group `V3-9113-015` and
   `026` while stating each separate obligation; include the Node 24.22.1
   persistence and open-stream controls.
5. **HTTP/2 concurrency-limit error scope** (`V3-9113-012`), reproduced on
   Node.js 24.22.2.
6. **TLS 1.2 renegotiation HTTP/2 error signaling** (`V3-9113-053`), reproduced
   on Node.js 24.22.2 with OpenSSL 3.5.9 and nghttp2 1.70.0.

The Node 22 connection-code substitutions already corrected in later releases
normally need release-line verification rather than new issue reports.

## Required regression coverage

| Area | Minimum regression evidence |
|---|---|
| 205 completion | Sync return, Promise/async return, empty result, explicit `Content-Length`/`Transfer-Encoding`, GET and HEAD, all four transports, diagnostics unchanged, next request succeeds. Assert no content octets and no content-implying framing. |
| If-Range 206 | Matching and nonmatching strong ETag, date-form conservative behavior, absent/invalid `If-Range`, identity/gzip/deflate, single and multi-member Range, GET/HEAD, HTTP/1.1 and HTTP/2. Assert exact retained field set. |
| Request-target overflow | Below/at/above configured boundary, long target with small fields, short target with oversized fields, fragmented request line, persistent/pipelined controls; assert 414 versus 431 and closure behavior. |
| Transfer coding | Known `chunked`, unknown-final rejection, unknown-non-final plus final `chunked`, fragmented chunks, connection reuse; assert status and application-visible bytes. |
| HTTP/2 state/errors | Raw frames with deliberate stream state, exact GOAWAY/RST_STREAM code and scope, whole and fragmented delivery, cleartext and TLS, standalone Node and Achieve. |
| SETTINGS / flow control | Valid boundaries and invalid values, active streams deliberately held open, concurrency-limit controls, initial-window overflow/non-overflow, connection and stream window controls. |
| HTTP/2 CONNECT 405 | Valid classic CONNECT and ordinary unsupported method controls; exact response fields, handler invocation count, cleartext/TLS. |
| TLS | TLS 1.2 and 1.3, ALPN `h2`, allowed/prohibited suite controls, default versus explicitly weakened policy, post-preface renegotiation wire error, platform/OpenSSL versions. |

Protocol regression tests should remain bounded and deterministic. A passing
sample establishes the tested case, not universal behavior across every state,
frame fragmentation, cipher, or runtime.

## Recommended remediation sequence

1. **Completed: `V3-9110-086`.** Four-transport regression coverage verifies
   no-content framing, native response semantics, and connection reuse.
2. **Completed: `V3-9110-088`.** Four-transport exact-header and byte-range
   coverage verifies the localized metadata omission and unchanged controls.
3. **Completed: adopt Node.js 24.22.2 as the qualified baseline.** Achieve
   3.1.0 requires Node.js 24, and final cross-platform qualification confirms
   the four requirement-level runtime corrections recorded above.
4. **Prepare upstream reports for defects that remain.** Prioritize mandatory
   wrong-scope/wrong-code HTTP/2 findings, request-target 414/431, and CONNECT
   405 `Allow`. Keep multiple RFC records traceable when one root cause is
   reported.
5. **Decide the TLS cipher-policy boundary (`V3-9113-056`).** Make an explicit
   compatibility decision before implementing configuration filtering.
6. **Re-run the complete conformance subset and 37-suite verifier after each
   remediation group.** Do not close the composite `V3-9113-007` merely because
   some narrower Node 22 substitutions are fixed.

## Decisions requiring approval

1. Should Achieve reject/filter explicitly configured RFC 9113-prohibited TLS
   1.2 cipher suites, or document a deliberate SHOULD-level departure when an
   application weakens OpenSSL policy (`V3-9113-056`)?
2. If the CONNECT 405 issue persists upstream, is a stream-layer Achieve
   workaround within scope, or should Achieve await a Node correction?
3. After duplicate searches, may the proposed upstream issues be filed, and
   under whose account/project process?

## Explicit unresolved questions

- Whether any supported Node API now distinguishes request-target overflow
  from field-section overflow; Node 24.22.2 does not.
- Whether the remaining stream `WINDOW_UPDATE(0)` defect has an accepted or
  released nghttp2 fix newer than the tested runtime.
- Whether enforcing the prohibited TLS 1.2 suite list belongs in Achieve or in
  deployment policy when an application explicitly supplies insecure options.
- Whether Node's classic CONNECT 405 can be augmented through a supported API
  without changing ordinary CONNECT/session behavior.

## Evidence basis

This plan is derived from `requirements-ledger-v3.csv`,
`conformance-summary.md`, `final-unverified-investigation.md`, the Batch A-F
evidence reviews, `http2-five-findings-investigation.md`,
`rfc9112-h105-investigation.md`, `rfc9112-h105-node-investigation.md`, and the
official RFC 9110, RFC 9112, and RFC 9113 texts. RFC 9111 contributes no current
Nonconformant record.

# Achieve 3.0.6 RFC 9113 Conformance Assessment

## Executive summary

This assessment covers all **62** RFC 9113 records in `requirements-ledger-v2.csv` for Achieve's supported cleartext HTTP/2 (h2c) and HTTP/2 over TLS (h2) origin-server endpoints on Node.js 22.15.0. Achieve delegates wire framing, HPACK, stream state, flow control, SETTINGS, and most protocol errors to Node.js/nghttp2; delegation is treated as endpoint responsibility but not automatically as proof.

| Classification | Count |
| --- | ---: |
| Conformant | 15 |
| Nonconformant | 0 |
| Unverified | 46 |
| Not applicable |  |
| Optional not implemented | 0 |
| **Total** | **62** |

No confirmed RFC 9113 violation was demonstrated. The large Unverified category is intentional: ordinary successful Node HTTP/2 sessions do not prove exact error scope/code for malformed frames, HPACK failures, flow-control boundaries, stream-state violations, TLS renegotiation, or prohibited TLS 1.2 ciphers.

## Complete requirement assessment

| ID | RFC | Transport | Classification | Responsibility | Basis |
| --- | --- | --- | --- | --- | --- |
| V2-NEW-049 | §3.4 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Successful standard Node HTTP/2 connections establish that the first server frame is acceptable as the required non-ACK SETTINGS frame on both transports. |
| V2-H201 | §4.1 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Node-generated HTTP/2 exchanges are accepted by the Node/nghttp2 client stack on h2c and h2; framing is entirely Node-owned and exercised end to end, though this is not independent implementation diversity. |
| V2-H202 | §4.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-050 | §4.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-051 | §4.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X044 | §4.3 | h2c and h2 | Unverified | Node.js HTTP/2 and nghttp2 HPACK implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X045 | §4.3 | h2c and h2 | Unverified | Node.js HTTP/2 and nghttp2 HPACK implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X046 | §5.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-052 | §5.1.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-053 | §5.1.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-054 | §5.1.2 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Achieve initiates no request streams and performs no server push, so it cannot exceed a peer limit for server-initiated streams. |
| V2-X047A | §5.1.2 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X047B | §5.1.2 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-055 | §5.2 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-H207 | §5.4.1 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-H208 | §5.4.2 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-057 | §6.5 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Successful sessions and requests require the SETTINGS exchange and acknowledgement to complete; observed on h2c and h2. |
| V2-NEW-058 | §6.5 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-072 | §6.5.2 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Achieve never invokes server push, so it does not push when the peer disables push. |
| V2-X048 | §6.5.2 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-H209 | §6.6 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-H211 | §6.7 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-060 | §6.7 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-H205 | §6.8 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | The Achieve server never initiates request streams; Node owns GOAWAY and prevents new stream creation through its session API. |
| V2-X065 | §6.8 | h2c and h2 | Conformant | Node.js HTTP/2 session, stream, framing, and flow-control implementation | As an origin server Achieve does not initiate request streams after receiving GOAWAY; no server push is used. |
| V2-X066 | §6.8 | h2c and h2 | Not applicable | Node.js HTTP/2 session, stream, framing, and flow-control implementation | The row describes retry permission for a request-initiating GOAWAY recipient. Achieve is assessed as an origin server and does not provide an HTTP/2 client. |
| V2-NEW-056 | §6.9 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-062 | §6.9 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X049 | §6.9 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X050 | §6.9 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-059 | §6.9.2 | h2c and h2 | Unverified | Node.js HTTP/2 session, stream, framing, and flow-control implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-070 | §8.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-H215 | §8.1.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-067 | §8.2.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-063 | §8.2.2 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-S009 | §8.2.2 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X059 | §8.2.2 | h2c and h2 | Unverified | Node.js HTTP/2 response serializer and Achieve/application response logic | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-068 | §8.2.3 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-064 | §8.3 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-065 | §8.3 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-066 | §8.3 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-069 | §8.3.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X051 | §8.3.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X052 | §8.3.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X053 | §8.3.1 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X054 | §8.3.1 | h2c and h2 | Conformant | Shared: Node.js pseudo-header parsing and Achieve authority validation | The authority suite demonstrates accepted authority-only and Host-only requests and rejects conflicts on h2c and h2. |
| V2-NEW-071 | §8.3.2 | h2c and h2 | Conformant | Node.js HTTP/2 response serializer and Achieve/application response logic | Node serializes the single status selected by Achieve; ordinary and error response suites demonstrate valid final status fields on both transports. |
| V2-X057 | §8.3.2 | h2c and h2 | Unverified | Node.js HTTP/2 response serializer and Achieve/application response logic | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X058 | §8.3.2 | h2c and h2 | Conformant | Node.js HTTP/2 response serializer and Achieve/application response logic | Response-completion tests demonstrate exactly one final response for exercised accepted requests on h2c and h2, including failure paths and subsequent health checks. |
| V2-H223 | §8.4 | h2c and h2 | Unverified | Node.js HTTP/2 response serializer and Achieve/application response logic | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X055 | §8.5 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X056 | §8.5 | h2c and h2 | Unverified | Node.js HTTP/2 parser; Achieve handles requests after parsing | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-NEW-073 | §9.2 | h2 | Conformant | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | Node 22 defaults to TLS 1.2 minimum, and the secure HTTP/2 suites establish successful supported h2 operation without an older TLS mode configured by Achieve. |
| V2-NEW-074 | §9.2 | h2 | Conformant | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | The Node/OpenSSL stack used by the supported endpoint has TLS compression disabled; Achieve exposes no option that enables it. |
| V2-NEW-075 | §9.2 | h2 | Unverified | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X060 | §9.2.1 | h2 | Conformant | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | Secure HTTP/2 connections made by Node clients negotiate h2 successfully, establishing ALPN h2 support. |
| V2-X061 | §9.2.1 | h2 | Conformant | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | The secure suites reach HTTP/2 request handling only after Node selects h2 by ALPN. |
| V2-X067 | §9.2.2 | h2 | Unverified | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X068 | §9.2.2 | h2 | Unverified | TLS/OpenSSL and Node.js HTTP/2; Achieve supplies server options | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X064 | §10.3 | h2c and h2 | Unverified | Node.js HTTP/2 and nghttp2 HPACK implementation | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |
| V2-X062 | §10.5.1 | h2c and h2 | Conformant | Node.js HTTP/2/nghttp2 resource controls; Achieve uses defaults | Node enforces a finite field-list pair limit for HTTP/2 sessions by default; Achieve does not disable that protection. |
| V2-X063 | §10.5.2 | h2c and h2 | Unverified | Node.js HTTP/2/nghttp2 resource controls; Achieve uses defaults | Delegation to Node/nghttp2 and successful ordinary traffic do not establish the exact malformed-frame, error-code, state-transition, resource-bound, or conditional behavior required by this broad record. |

The machine-readable evidence and unresolved questions are in [rfc9113-conformance.csv](rfc9113-conformance.csv).

## Established endpoint behavior

- `achieve.listen2(port)` creates a cleartext Node HTTP/2 server; `listen2({ key, cert, http2Port })` creates a TLS HTTP/2 server (`achieve.js:1463-1512`).
- Existing suites establish successful preface/SETTINGS exchange, ordinary framing, one final response, authority processing, request-target error resets, and ALPN-based secure HTTP/2 operation on both h2c and h2.
- Achieve does not call `pushStream` and does not initiate client request streams. Server-push and GOAWAY client-retry permissions therefore do not become hidden application-server features.
- Achieve validates `:authority`/Host consistency after Node parsing (`achieve.js:1167-1253`) and explicitly resets malformed-target streams with `NGHTTP2_PROTOCOL_ERROR` (`achieve.js:1414-1424`).

## Unverified obligations grouped by cause

### Raw framing and stream-state error behavior
Frame-size errors, reserved bits, unknown types, stream identifier ordering, concurrent-stream overflow, GOAWAY/RST_STREAM scope, SETTINGS range errors, PING, and WINDOW_UPDATE/flow-control boundary cases require deliberate raw-frame probes. Node's public high-level client prevents constructing many invalid sequences, and no such probe corpus exists in the repository.

### HPACK and malformed field blocks
Contiguous field-block decoding, COMPRESSION_ERROR, connection-specific fields, illegal TE, uppercase names, pseudo-header ordering/context/duplication, and compression-context isolation are Node/nghttp2 responsibilities. Existing semantic tests do not establish exact connection-versus-stream errors for all malformed encodings.

### Message semantics
Existing tests establish authority handling, valid final responses, correct response lengths, and one concrete malformed-target stream reset. They do not isolate mismatched request Content-Length, every pseudo-header omission/duplication, classic CONNECT malformed combinations, or informational-response behavior.

### TLS and resource security
ALPN h2 negotiation and ordinary TLS 1.2-or-later operation are established. Renegotiation exceptions, every prohibited TLS 1.2 cipher, the required INADEQUATE_SECURITY response, and broad denial-of-service work bounds remain unverified. The field-section-size limit is established through Node's finite default, but its SETTINGS advertisement and every enforcement boundary were not independently probed.

## h2c and h2 distinctions

The HTTP/2 frame, stream, HPACK, and semantic requirements apply after connection establishment to both transports. Existing application-level suites ran on both. Section 9.2 TLS requirements apply only to h2. Achieve's h2c endpoint is prior-knowledge cleartext HTTP/2 created by `http2.createServer`; the assessed code does not implement HTTP/1.1 Upgrade to h2c.

## Ledger issues

1. **V2-H211 and V2-NEW-060** duplicate the same PING acknowledgement obligation.
2. **V2-X057 and V2-H223** overlap the same optional informational-response capability.
3. **V2-H201** records broad frame grammar without a BCP 14 level; it is not a single independently falsifiable requirement.
4. **V2-H215** combines malformed request and malformed response handling even though Achieve's endpoint roles and required error actions differ; it should be split.
5. Several rows summarize a normative definition as a MUST-level implementation duty without preserving all scope/error qualifications. The CSV retains the ledger wording and flags uncertainty rather than silently rewriting it.

## Tests executed

All existing focused suites executed without source changes and passed:

- `tests/http2_authority/verify.js`: all h2c and h2 authority checks passed.
- `tests/request_target_syntax/verify.js`: all 560 checks passed across HTTP, HTTPS, h2c, and h2.
- `tests/connect/verify.js`: all checks passed, including HTTP/2 CONNECT returning 405.
- `tests/response_completion/verify.js`: passed across HTTP, HTTPS, h2c, and h2.
- `tests/static_length/verify.js`: all 88 checks passed across the four transports.

No custom malformed-frame probe was run. Such a probe would need direct frame construction below Node's public high-level client API and was not necessary to avoid overstating the evidence.

## Recommended follow-up verification

1. Build a bounded raw HTTP/2 frame harness for preface, SETTINGS, frame-size, reserved-bit, unknown-frame, PING, GOAWAY, RST_STREAM, and WINDOW_UPDATE cases on both h2c and h2.
2. Add controlled HPACK blocks for compression failure and pseudo-header/name/connection-field violations, checking exact stream or connection error codes.
3. Probe request Content-Length mismatch and classic CONNECT pseudo-header combinations independently of Achieve application dispatch.
4. Record negotiated TLS version, ALPN, TLS compression state, TLS 1.2 cipher behavior, and renegotiation rejection using supported Node/OpenSSL interfaces.
5. Inspect version-specific Node/nghttp2 resource controls and probe bounded field-section, concurrent-stream, and control-frame limits before classifying the broad denial-of-service rows.

## Validation

The CSV contains exactly one row for every RFC 9113 ID from the v2 ledger. Classification totals are generated from the CSV source data. All local source/test references were checked against the repository. No implementation, test, ledger, previous assessment, or specification prototype was modified.

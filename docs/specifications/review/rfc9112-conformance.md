# Achieve 3.0.6 RFC 9112 Conformance Assessment

## Executive summary

This assessment covers all **39** RFC 9112 records in `requirements-ledger-v2.csv` against the supported Achieve HTTP/1.1 endpoint on Node.js 22. Achieve delegates wire parsing, response serialization, connection reuse, and TLS shutdown primarily to Node.js; delegation is not treated as proof. Existing tests, source inspection, and bounded raw-TCP observations are distinguished below.

| Classification | Count |
| --- | ---: |
| Conformant | 25 |
| Nonconformant | 1 |
| Unverified | 8 |
| Not applicable | 4 |
| Optional not implemented | 1 |
| **Total** | **39** |

One confirmed defect was demonstrated: **V2-H105**. A 20,001-character request-target received **431**, while RFC 9112 §3 requires **414** when the target exceeds what the server is willing to parse. This is Node-parser-owned behavior at the supported endpoint. No other confirmed violation was established. Eight obligations remain unverified, principally because they require Node parser internals, byte-level chunk/trailer probes, or TLS alert observation.

## Complete requirement assessment

| ID | RFC | Classification | Responsible component | Basis |
| --- | --- | --- | --- | --- |
| V2-H101 | §2.2 | Unverified | Node.js HTTP sender; Achieve selects status, fields, and body | Observed responses are parseable and existing tests pass, but the broad sender-grammar and version obligation was not exhaustively verified. |
| V2-H102 | §2.2 | Unverified | Node.js HTTP parser | Delegation and rejection behavior do not establish that all parsing is performed as an octet sequence. |
| V2-X031 | §2.2 | Conformant | Node.js HTTP parser | The supported Node 22.15 endpoint ignored at least one leading empty line as recommended. |
| V2-NEW-036 | §2.3 | Conformant | Node.js HTTP parser | Rejection is one of the two permitted behaviors. |
| V2-H104 | §3 | Conformant | Node.js HTTP parser; Achieve validates target after parsing | Observed parsing follows the request-line component model and malformed input does not reach application dispatch. |
| V2-H105 | §3 | Nonconformant | Node.js HTTP parser | RFC 9112 §3 says a target longer than the server is willing to parse MUST receive 414; the supported endpoint instead returns 431. The ledger incorrectly labels this as SHOULD. |
| V2-H106 | §3.1 | Conformant | Node.js HTTP parser | The observed 400 satisfies the ledger expectation and RFC invalid-request-line recommendation. |
| V2-H107 | §3.2.1 | Not applicable | External HTTP client | Client request-target generation is outside Achieve’s supported origin-server role. |
| V2-H108 | §3.2.2 | Conformant | Node.js parser and Achieve request-target logic | The endpoint accepts absolute-form and maps its path/query for origin-server processing. |
| V2-S008 | §3.2.2 | Conformant | Achieve request-target and authority validation | Achieve extracts authority from absolute-form and does not use Host as the target authority. |
| V2-H109 | §3.2.3 | Not applicable | External HTTP client | This is a client-only generation rule. Achieve’s server-side CONNECT behavior is assessed separately. |
| V2-H110 | §3.2.4 | Unverified | External client/proxy and Node/Achieve OPTIONS handling | The row improperly combines a client MUST with a supposed origin-server empty-path duty. RFC 9112 §3.2.4 actually requires the final proxy to translate an absolute-form OPTIONS URI with empty path/no query to *, not an origin server to normalize an empty path. |
| V2-NEW-037 | §5 | Conformant | Node.js HTTP parser | The required rejection was observed. |
| V2-NEW-038 | §5.2 | Conformant | Node.js HTTP parser | Rejecting obs-fold is one of the permitted required alternatives. |
| V2-H112 | §6.1 | Conformant | Node.js HTTP parser/socket | The endpoint did not reuse the faulty-framed HTTP/1.0 connection; RFC permits processing before closure. |
| V2-NEW-040 | §6.1 | Unverified | Node.js HTTP parser | That probe cannot isolate the §6.1 SHOULD to return 501 for an unrecognized coding because the §6.3 MUST also applies. |
| V2-X037 | §6.1 | Conformant | Node.js HTTP parser/socket | Rejection is expressly permitted instead of processing Transfer-Encoding alone. |
| V2-X038 | §6.1 | Conformant | Node.js HTTP parser/socket | Mandatory closure after responding was observed. |
| V2-H115 | §6.3 | Conformant | Node.js HTTP parser | Requests with neither Transfer-Encoding nor Content-Length are delivered with zero-length bodies. |
| V2-NEW-041 | §6.3 | Conformant | Node.js HTTP parser/socket | The mandatory status and closure were observed. |
| V2-NEW-042 | §6.3 | Conformant | Node.js HTTP parser/socket | Invalid/conflicting Content-Length is treated as unrecoverable. The identical-list exception permits successful normalization but does not require it. |
| V2-NEW-043 | §6.3 | Conformant | Node.js HTTP parser/socket and Achieve buffered-input listeners | Prematurely terminated framed request bodies are not delivered as complete application input and their connections are closed. |
| V2-X032 | §6.3 | Conformant | Node.js HTTP sender plus Achieve sendBody/status logic | The supported HTTP/1.1 endpoint suppresses prohibited bodies for tested HEAD/304 and error paths; Node owns final wire framing. |
| V2-X033 | §6.3 | Optional not implemented | Achieve/Node CONNECT endpoint | Achieve does not establish successful CONNECT tunnels, so the conditional 2xx tunnel framing case is absent and permitted. |
| V2-X034 | §6.3 | Conformant | Node.js HTTP parser and Achieve request stream | Observed request-body completion depends on decoding through the terminal chunk. |
| V2-X035 | §6.3 | Conformant | Node.js HTTP parser and Achieve request stream | Valid Content-Length controls expected request length, and incomplete bodies are not treated as complete. |
| V2-X036 | §6.3 | Not applicable | External HTTP response recipient | The row’s response-recipient framing algorithm does not apply to Achieve’s supported origin-server role. |
| V2-NEW-044 | §7 | Not applicable | External request sender | The recorded obligation explicitly concerns transfer coding applied to a request, while its applicability text incorrectly refers to application-authored responses. |
| V2-NEW-045 | §7 | Conformant | Node.js HTTP response sender | No Achieve response path applies chunked twice; Node controls serialization. |
| V2-H116 | §7.1 | Conformant | Node.js HTTP response sender | Successful parsing to end by Node clients establishes valid terminal framing for exercised chunked responses. |
| V2-H117 | §7.1.1 | Unverified | Node.js HTTP parser | No source inspection or observation establishes that unknown extensions are ignored on the supported runtime. |
| V2-H118 | §7.1.2 | Unverified | Node.js HTTP parser; application can inspect IncomingMessage trailers | Node delegation is known, but no evidence was collected that received trailers remain separate from headers for this endpoint. |
| V2-H119 | §9.3 | Conformant | Node.js socket/parser plus Achieve input handling | Observed GET body bytes were framed/consumed before the next request, while POST body listeners consume complete input and aborted bodies close. |
| V2-NEW-046 | §9.3.2 | Conformant | Node.js HTTP server/socket | The mandatory response-order portion is demonstrated. Parallel processing is optional and need not be implemented. |
| V2-X039 | §9.6 | Conformant | Node.js HTTP server/socket | Mandatory connection closure was observed. |
| V2-X040 | §9.6 | Conformant | Node.js HTTP server/socket | The recommended response signal was observed. |
| V2-X041 | §9.6 | Conformant | Node.js HTTP server/socket | The server did not process a request following the close signal. |
| V2-X042 | §9.8 | Unverified | Node.js TLS/OpenSSL | Application-level HTTPS success does not prove that a close_notify alert is emitted on every orderly server closure. |
| V2-X043 | §9.8 | Unverified | Node.js TLS/OpenSSL and HTTP parser | Available evidence does not establish the ledger’s broad recipient behavior for incomplete TLS closure. |

The machine-readable evidence, including exact obligation text, source/test references, probe evidence, and unresolved questions, is in [rfc9112-conformance.csv](rfc9112-conformance.csv).

## Confirmed nonconformity

### V2-H105 — overlong request-target status

RFC 9112 §3 states that a server receiving a request-target longer than it is willing to parse **MUST** respond with 414. On Node.js v22.15.0, a raw request with a 20,001-character target received `HTTP/1.1 431 Request Header Fields Too Large`, `Connection: close`, and connection termination. Achieve never receives the request because Node rejects it during parsing. The ledger incorrectly records the normative level as SHOULD.

Reproduction shape (local loopback only):

`GET /` + 20,000 `a` octets + ` HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`

This is a demonstrated status-code defect, not merely missing coverage. It does not imply that the parser’s size limit or connection closure is unsafe.

## Node.js-owned obligations and observed behavior

The local raw-TCP probe used Node.js **v22.15.0**, a temporary application directory, and Achieve 3.0.6 on loopback. Each connection had a bounded timeout; the server and directory were removed afterward.

Observed conformant cases included:

- leading CRLF ignored (200);
- whitespace line after request-line rejected (400/close);
- whitespace before field colon rejected (400/close);
- obs-fold rejected (400/close);
- invalid method token rejected (400/close);
- HTTP/1.0 Transfer-Encoding connection closed after processing;
- Transfer-Encoding plus Content-Length rejected and closed;
- conflicting Content-Length rejected and closed;
- non-chunked final transfer coding rejected and closed;
- pipelined responses retained request order (404, then 200);
- a framed GET body was consumed before the following pipelined request (200, then 200);
- requests after a Connection: close signal were not processed.

These observations apply to the tested Node patch version and input shapes. They do not prove every parser state or supported Node 22 patch release.

## Unverified obligations grouped by reason

### Parser implementation evidence unavailable

- **V2-H101**: full sender grammar/version conformance is broader than parseable test responses.
- **V2-H102**: no direct evidence that all parsing uses an octet sequence rather than unsafe Unicode processing.
- **V2-NEW-040**: the observed unknown non-chunked coding also triggered the mandatory §6.3 400 rule, so the §6.1 501 recommendation was not isolated.

### Ledger ambiguity prevents a single clean result

- **V2-H110** mixes a client requirement with an incorrectly attributed empty-path rule; the RFC’s second rule is a final-proxy forwarding obligation.

### Missing focused chunk/trailer verification

- **V2-H117**: unknown chunk extensions were not directly exercised.
- **V2-H118**: separation of trailer fields from headers was not directly observed.

### TLS alert behavior not observed

- **V2-X042** and **V2-X043** require TLS-record-level or deliberately truncated TLS evidence; successful HTTPS tests alone are insufficient.

## Ledger issues discovered

The inventory was not modified. The following issues should be corrected in a future ledger revision:

1. **V2-H105:** RFC 9112 §3 uses **MUST**, not SHOULD, for the 414 response.
2. **V2-H106:** the exact 400 recommendation comes from §3 invalid request-line handling (which also permits a properly encoded 301), not a standalone §3.1 invalid-method-token sentence.
3. **V2-H110:** combines a client MUST with a proxy-only forwarding rule and misstates the latter as an origin-server empty-path duty.
4. **V2-NEW-043:** combines premature close and timeout cases; its summary obscures the ordered framing rule and separate optional server error response in §8.
5. **V2-X036:** is a response-recipient rule and is not applicable to Achieve solely because Achieve sends HTTP/1.1 responses.
6. **V2-NEW-044:** concerns request senders, while its applicability refers incorrectly to application-authored responses.
7. **V2-NEW-045:** should identify the sender role; recipient is not responsible for applying chunked.
8. **V2-NEW-046:** combines optional parallel processing (MAY) with mandatory response ordering (MUST); these should be split.
9. **V2-X042 / V2-X043:** do not accurately preserve §9.8’s distinct client/server requirements. In particular, servers MUST attempt to initiate closure-alert exchange; client completeness rules and server preparedness for incomplete close are separate.

## Existing tests executed

All five relevant existing suites passed without source changes:

- `tests/request_target_syntax/verify.js`: 560 checks passed.
- `tests/response_completion/verify.js`: passed for HTTP, HTTPS, h2c, and secure HTTP/2.
- `tests/connect/verify.js`: all CONNECT checks passed.
- `tests/request_input/verify.js`: all request-input checks passed.
- `tests/buffered_abort/verify.js`: all buffered POST abort checks passed.

HTTP/2 results are useful regression evidence but are not used to establish RFC 9112 conformance.

## Prioritized follow-up

1. **High:** decide how the HTTP/1.1 endpoint can map request-target overflow to 414 while retaining Node parser protections (V2-H105).
2. **High:** add a raw regression suite for TE/CL conflicts, conflicting Content-Length, close behavior, and pipelining so security-relevant observations are repeatable.
3. **Medium:** isolate unrecognized transfer coding followed by final chunked (V2-NEW-040).
4. **Medium:** verify unknown chunk extensions and trailer separation (V2-H117/H118).
5. **Medium:** observe TLS close_notify and truncated-message handling on supported Node/OpenSSL combinations (V2-X042/X043).
6. **Low:** inspect or test octet parsing and response grammar across the supported Node 22 matrix (V2-H101/H102).

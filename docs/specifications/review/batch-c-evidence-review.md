# Batch C Node HTTP/1 semantics evidence review

## Scope and method

This review covers the 11 Batch C records identified in
`unverified-requirements-plan.md`. It assesses Achieve 3.0.6 on Node.js
22.15.0 against the exact RFC 9110 conditions. Existing source and verifier
evidence was reviewed first. A temporary bounded raw-TCP probe then compared
the Achieve HTTP/1.1 endpoint with a standalone `node:http` server using the
same parser and timeout options. The temporary probe and application directory
were removed after execution.

The focused probe covered normalized and raw repeated request fields,
duplicate `Content-Length`, individual and aggregate field-section overflow,
`Expect: 100-continue` with content withheld, an unsupported expectation, an
HTTP/1.0 expectation control, and an intentionally shortened request-header
timeout. These observations establish concrete conditions; they do not turn a
bounded corpus into proof of universal sender syntax or recipient semantics.

## Decisions

| ID | Normative requirement and owner | Evidence | Decision |
|---|---|---|---|
| V3-9110-001 | RFC 9110 §2.2: a sender **MUST NOT** generate elements outside the corresponding ABNF. Responsibility is shared among Achieve, Node serialization, and application-authored output. | Existing tests capture many ordinary and exceptional responses, and the Batch C responses were syntactically parseable. The evidence does not validate every Achieve-generated start-line/field path, all HTTP versions, or arbitrary application-authored values against every governing ABNF. | **Unverified.** Representative valid output is not sufficient to establish this universal prohibition. |
| V3-9110-002 | RFC 9110 §2.2: within a message, a sender **MUST NOT** use syntax alternatives reserved to a role it does not have. Responsibility is shared, with applications controlling fields they explicitly author. | Source review found no Achieve core path intentionally generating intermediary- or client-only syntax. The focused probe did not enumerate every role-specific alternative or constrain arbitrary servlet output. | **Unverified.** No violation was demonstrated, but the required sender-wide role audit is incomplete. |
| V3-9110-003 | RFC 9110 §2.3 says recipients **SHOULD** parse defensively and make only marginal assumptions about conformance and length. Node's parser owns most HTTP/1.1 syntax acceptance; Achieve adds target and authority validation. | `tests/request_target_syntax/verify.js` passed all 560 checks across HTTP, HTTPS, h2c, and secure HTTP/2. Batch C additionally observed safe handling of repeated fields, invalid duplicate length, and field-size limits. This still is not the representative whitespace, edge-grammar, and boundary corpus called for by the broad recommendation. | **Unverified.** Evidence is favorable but incomplete for the section-wide SHOULD. |
| V3-9110-004 | RFC 9110 §2.3 requires a recipient to accept protocol-element lengths at least as long as values it generates for the same elements. Node owns parser limits; Achieve selects some emitted values. | The probe established field limits and ordinary generated values but did not inventory the longest generated value for each same element and compare it with the corresponding receive path. Aggregate request limits also are not directly comparable with every response element. | **Unverified.** The necessary generation-versus-acceptance comparison remains absent. |
| V3-9110-005 | RFC 9110 §2.4 requires received elements to be interpreted according to their defined semantics unless a justified compatibility workaround applies. Responsibility is shared by Node, Achieve, and servlet applications. | Existing suites directly verify many particular semantics, and the repeated-field probe verified selected field classes. The ledger row is intentionally broader than those specific records and no complete inventory of every consumed or exposed element was assessed in Batch C. | **Unverified.** Specific successes do not establish the universal semantic obligation. |
| V3-9110-010 | RFC 9110 §5.3 permits combining repeated field lines only without semantic change, in order, using comma plus optional whitespace. Node parses and combines; Achieve consumes its normalized and raw views. | Repeated `Accept` became `text/plain, text/html`; repeated `Cookie` became `a=1; b=2` under Cookie's special semantics; duplicate `Authorization` retained the first value rather than being combined; duplicate `Content-Length` was rejected with 400. `rawHeaders` preserved all lines and their order. Standalone Node matched Achieve. | **Conformant** for the exercised list, special-case, non-list, and framing-invalid classes on Node 22.15.0. Newly defined field semantics remain dependent on Node support. |
| V3-9110-011 | RFC 9110 §5.4 requires an appropriate 4xx when a server refuses a request field line, value, or set that is larger than it wishes to process; it must not silently ignore the input. Node owns parsing before Achieve dispatch. | A short-target request with one 17,000-octet field value received 431. A separate section containing 180 individually small fields and exceeding the aggregate limit also received 431. Neither request reached the application with fields omitted. Standalone Node was identical. `rfc9112-h105-investigation.md` independently records the oversized-field control. | **Conformant.** The separate overlong request-target case remains a confirmed RFC 9112 status-code defect, not a failure of this oversized-field obligation. |
| V3-9110-046 | RFC 9110 §10.1.1 requires an origin server receiving a qualifying HTTP/1.1 `100-continue` request to send either an immediate final response or immediate 100 Continue. Node owns default expectation handling because Achieve installs no `checkContinue` or `checkExpectation` listener. | With complete headers and all four content octets withheld, the wire first contained exactly `HTTP/1.1 100 Continue` and its terminating empty line. After the probe sent `DATA`, the endpoint returned 200 and confirmed the body. Unsupported `Expect` produced final 417; the HTTP/1.0 control produced no 100. Standalone Node matched. | **Conformant** on the assessed Node 22.15.0 HTTP/1.1 endpoint. |
| V3-9110-047 | RFC 9110 §10.1.1 says the origin server **MUST NOT** wait for request content before sending its 100 response. | The client withheld all content. The complete 100 response arrived first, observed 1 ms after header transmission; only the probe's data callback then sent `DATA`. Final 200 followed. The standalone server had the same ordering. | **Conformant.** Wire order, rather than the incidental local latency, establishes the result. |
| V3-9110-051 | RFC 9110 §10.2.1 says an origin server **without a clock MUST NOT** generate `Date`. | The assessed Windows/Node environment has a usable system clock. Achieve uses it for static response origination (`achieve.js:1768-1777`), Node uses it for ordinary automatic Date generation, and `tests/static_dates/verify.js:82-108` verifies clock-backed output. Artificially replacing JavaScript `Date` would not represent a clockless origin-server environment. | **Not applicable** to the assessed configuration because the explicit condition is false. This is not a claim about a hypothetical supported clockless platform. |
| V3-9110-099 | The former row claimed RFC 9110 §15.5.9 says a 408 response **SHOULD** carry `Connection: close`. Section 15.5.9 contains no such normative statement; that wording came from superseded RFC 7231 §6.5.7. | For operational context, shortening Node's header timeout produced `HTTP/1.1 408 Request Timeout`, `Connection: close`, and an orderly socket close for Achieve and standalone Node. That behavior is useful but cannot prove a nonexistent RFC 9110 requirement. | **Not applicable / inventory correction.** The ID remains for V2 traceability, its level is corrected to `None`, and the mapping is marked Corrected. |

## Raw-wire observations

| Case | Achieve 3.0.6 / Node 22.15.0 | Standalone Node 22.15.0 | Responsibility established |
|---|---|---|---|
| Repeated `Accept`, `Authorization`, and `Cookie` | Ordered field-specific normalization; complete ordered `rawHeaders` | Identical | Node HTTP parser |
| Duplicate `Content-Length` | 400, connection closed | Identical | Node HTTP parser |
| One oversized field | 431, connection closed | Identical | Node HTTP parser/default error response |
| Oversized aggregate section | 431, connection closed | Identical | Node HTTP parser/default error response |
| Qualifying `100-continue`, body withheld | 100 before body; 200 after `DATA` | Identical | Node default expectation handling |
| Unsupported expectation | 417 final response | Identical | Node default expectation handling |
| HTTP/1.0 `100-continue` control | No 100; final 200 after body | Identical | Node default expectation handling |
| Bounded incomplete-header timeout | 408, `Connection: close`, socket closed | Identical | Node timeout handling; informational for RFC 9110 |

The Achieve server factory at `achieve.js:1559-1591` passes only its request
listener to `http.createServer()` and does not install expectation handlers.
The standalone comparison therefore confirms, rather than merely assumes, the
Node ownership of the observed parser, expectation, and timeout behavior.

## Classification reconciliation

Batch C changes four records from Unverified to Conformant, changes one
conditional record from Unverified to Not applicable, and corrects one
non-normative inherited record from Unverified to Not applicable. Five broad
records remain Unverified.

| RFC | Conformant | Nonconformant | Unverified | Not applicable | Optional not implemented | Total |
|---|---:|---:|---:|---:|---:|---:|
| RFC 9110 | 81 | 2 | 5 | 9 | 3 | 100 |
| RFC 9111 | 0 | 0 | 0 | 3 | 4 | 7 |
| RFC 9112 | 25 | 1 | 7 | 7 | 1 | 41 |
| RFC 9113 | 28 | 5 | 24 | 3 | 0 | 60 |
| **Overall** | **134** | **8** | **36** | **22** | **8** | **208** |

Before Batch C, the totals were 130 Conformant, 8 Nonconformant, 42
Unverified, 20 Not applicable, and 8 Optional not implemented. No new
nonconformity was found. The 208-record inventory and every V3 identifier are
preserved.

## Remaining questions

The five unresolved §2 records require broader, cross-version evidence than
Batch C's bounded HTTP/1.1 probes: a sender-output ABNF and role corpus,
defensive-parser edge matrices, generated-versus-accepted length comparisons,
and element-by-element semantic review. They should not be resolved by
extrapolating from the concrete cases above.

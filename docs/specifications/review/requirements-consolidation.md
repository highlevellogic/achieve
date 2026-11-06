# Achieve HTTP Requirements V2-to-V3 Consolidation

## Result

The V2 inventory contained **209** rows. V3 contains **211** corrected requirements. Every V2 ID maps to one or more V3 successors or to a documented removal in `requirements-v2-v3-mapping.csv`; one newly discovered RFC 9113 obligation has no V2 predecessor.

## Inventory changes

- Removed `V2-C006`: RFC 9111 section 5.4 does not contain the recorded Pragma cache permission.
- Removed `V2-H201`: descriptive HTTP/2 frame grammar, not a discrete normative obligation.
- Merged `V2-H211` with duplicate `V2-NEW-060` (PING acknowledgement).
- Merged `V2-X057` with overlapping `V2-H223` (optional informational responses); corrected the controlling section to RFC 9113 section 8.3.2.
- Split `V2-H110` into client asterisk-form generation and final-proxy forwarding; neither is an Achieve origin-server obligation.
- Split `V2-X042` into the server MUST to initiate TLS closure alerts and the server SHOULD to tolerate incomplete client close.
- Split `V2-H215` into malformed-request server handling and malformed-response client handling.
- Narrowed `V2-NEW-046` to mandatory pipelined response ordering; the independent MAY to parallelize safe requests is permission, not a conformance obligation.
- Corrected RFC 9110 sender/recipient roles for V2-NEW-006, 007, 018, 028, and 029, and RFC 9111 directive-sender roles for V2-NEW-031 through 034.
- Corrected RFC 9112 role/scope issues for V2-X036, V2-NEW-044, V2-H106, V2-NEW-043, and V2-X043.
- Corrected `V3-9113-005` from a decoder-processing statement to RFC 9113 section 4.3's sender obligation for contiguous field-block transmission.
- Corrected `V3-9113-034` to RFC 9113 section 8.2.2's distinct endpoint sender prohibition. Its former wording duplicated the receiver obligation in `V3-9113-035` and incorrectly used proxy scope.
- Corrected `V3-9113-058` to RFC 9113 section 10.3's intermediary validation-before-translation obligation. The former HPACK-context wording was not stated by that section.
- Corrected `V3-9113-011` to RFC 9113 section 5.1.2's actual dynamic-limit alternative: after reducing the advertised concurrent-stream limit below the current open count, an endpoint can close excess streams or allow them to complete. The former concurrent-opening MAY wording is not present in RFC 9113.
- Corrected `V3-9113-053` to section 9.2.1's post-preface TLS 1.2 renegotiation obligation and required connection `PROTOCOL_ERROR`, rather than a broad client-only prohibition.
- Corrected `V3-9113-056` from MUST NOT to the section 9.2.2 **SHOULD NOT** recommendation concerning prohibited TLS 1.2 cipher suites.
- Corrected `V3-9113-057` from a fabricated MUST to section 9.2.2's **MAY** permission to use `INADEQUATE_SECURITY` for a prohibited TLS 1.2 cipher.
- Corrected `V3-9113-060` from MUST to section 10.5.2's **SHOULD** recommendation to track exposed work/resource commitments and set limits.
- Corrected `V3-9110-099`: RFC 9110 section 15.5.9 does not retain RFC 7231's former recommendation to send `Connection: close` with 408. The identifier remains as a traceable Not applicable inventory correction rather than a fabricated RFC 9110 requirement.
- Split `V2-X043` into `V3-9112-041`, the incomplete-close client recovery SHOULD, and `V3-9112-042`, the separate close-delimited response-completeness rule.
- Retained `V3-9113-007` as an explicitly documented composite for V2 traceability and separated the mandatory malformed-request rule in `V3-9113-031` from its optional response permission.
- Corrected `V3-9113-059` to section 10.5.1's actual field-block processing/state-consistency MUST and returned it to Unverified pending direct evidence.
- Split the TLS 1.2 renegotiation-disablement obligation from `V2-NEW-075` into new `V3-9113-062`; it remains Unverified. Added new `V3-9113-061` for section 9.2.2's mandatory cipher-suite and P-256 support, an obligation absent from V2; it also remains Unverified.
- Reclassified `V3-9110-098` as Nonconformant after a focused HTTP/2 CONNECT reproduction established a Node-generated 405 without the required Allow field.

## Classification totals

| RFC | Conformant | Nonconformant | Unverified | Not applicable | Optional not implemented | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RFC 9110 | 81 | 3 | 5 | 8 | 3 | 100 |
| RFC 9111 | 0 | 0 | 0 | 3 | 4 | 7 |
| RFC 9112 | 31 | 2 | 0 | 8 | 1 | 42 |
| RFC 9113 | 39 | 10 | 9 | 3 | 1 | 62 |
| **Overall** | **151** | **15** | **14** | **22** | **9** | **211** |

## Classification reconciliation

Classifications were inherited only where corrected scope remained covered. Split requirements were classified independently. Merged rows did not inherit a more favorable result. Role corrections changed applicability where the V2 role was wrong. No successful ordinary exchange was used to establish malformed-frame or exceptional-state conformance.

### Confirmed nonconformity: oversized HTTP/1.1 request-target
RFC 9112 section 3 requires 414 when the request-target exceeds the accepted length. The tested Achieve endpoint returns 431 on Node.js 22.15.0 and 24.22.1. Node reports both request-target and field overflow as `HPE_HEADER_OVERFLOW`. Historical issue [nodejs/node#26296](https://github.com/nodejs/node/issues/26296) was closed after [PR #25605](https://github.com/nodejs/node/pull/25605) changed generic overflow from 400 to 431, but that did not implement the 414/431 distinction. Raising `maxHeaderSize` only moves the shared boundary. Achieve is not adding a second request-line parser; the V3 requirement remains **Nonconformant**, identified as a Node-inherited bug of the tested endpoint. No new upstream issue has been filed.

### Confirmed nonconformities: HTTP/2 error code and scope

Bounded raw-frame probes against Achieve 3.0.6 on the assessed Node.js 22.15.0 configuration establish five Nonconformant RFC 9113 requirements: `V3-9113-007`, `V3-9113-008`, `V3-9113-019`, `V3-9113-020`, and `V3-9113-026`. The requirement count is five, but the investigation found two underlying causes rather than five independent Achieve defects.

Node 22.15.0 substituted `INTERNAL_ERROR` while closing from inside an nghttp2 receive callback, overriding the protocol-specific error selected for invalid frame/state, stream parity, SETTINGS, PUSH_PROMISE, and WINDOW_UPDATE cases. This Node behavior was corrected in later Node releases; Node 24.22.1 produced the required `PROTOCOL_ERROR` for the tested connection-level cases. Separately, current nghttp2 treats zero-increment WINDOW_UPDATE on a nonzero stream as a connection error. Node 24 preserves the correct `PROTOCOL_ERROR` code but still sends GOAWAY rather than the required stream-scoped RST_STREAM. See `http2-five-findings-investigation.md` for the exact frame bytes, runtime comparison, and upstream history. These classifications describe the tested Node 22.15.0 endpoint and are not silently generalized to every Node version.

### Batch A evidence reconciliation

Review of the existing P-series raw-frame evidence resolved 14 previously Unverified RFC 9113 requirements as Conformant without new probes: `V3-9113-002`, `004`, `006`, `017`, `021`, `033`, `035`, `037`, `038`, `040`, `041`, `042`, `043`, and `044`. Corrected `V3-9113-005` and `V3-9113-034` remain Unverified sender obligations because the existing probes are receiver-side. Corrected `V3-9113-058` is Not applicable because Achieve is not an HTTP intermediary translating HTTP/2 messages to another version. See `batch-a-evidence-review.md`.

### Batch B semantic reconciliation

Focused HTTP/1.1 and h2c checks plus source review resolved all 13 Batch B records. Nine are Conformant, two conditional application-status obligations are Not applicable to Achieve core, and two are Nonconformant. HTTP/1.1 sends servlet-returned content with status 205, contrary to `V3-9110-086`. Matching If-Range 206 responses unnecessarily repeat Content-Type and Last-Modified, missing the SHOULD NOT recommendation in `V3-9110-088`. See `batch-b-evidence-review.md`.

### Batch C Node HTTP/1 semantics reconciliation

Bounded raw-TCP comparison of Achieve and standalone Node.js 22.15.0 resolved four concrete records as Conformant: `V3-9110-010`, `011`, `046`, and `047`. Conditional clockless record `V3-9110-051` is Not applicable to the assessed clock-backed runtime. `V3-9110-099` is also Not applicable after correcting the inherited non-normative 408 connection-field statement. The broad §2 sender and recipient records `001` through `005` remain Unverified because representative successes do not establish universal syntax, role, length, defensive-parsing, or semantic obligations. See `batch-c-evidence-review.md`.

### Batch D HTTP/1.1 framing and TLS reconciliation

Raw TCP, fragmented chunk, standalone Node, and TLS record/abort probes resolved all seven Batch D records. `V3-9112-001`, `002`, `032`, `033`, `039`, and `040` are Conformant on the tested Node.js 22.15.0/OpenSSL stack. `V3-9112-017` is Nonconformant at SHOULD level: an unrecognized transfer coding followed by final chunked receives 200 and reaches the application without decoding the unknown coding rather than receiving 501. This Node-parser behavior is distinct from the MUST-level 414/431 request-target defect. See `batch-d-evidence-review.md`.

### Batch E HTTP/2 state and flow-control reconciliation

Focused raw-frame probes on Node.js 22.15.0/nghttp2 1.64.0 resolved nine of 13 Batch E records. `V3-9113-009`, `013`, `025`, `027`, `030`, and `039` are Conformant. `V3-9113-012` is Nonconformant because exceeding an advertised concurrent-stream limit produced connection GOAWAY `INTERNAL_ERROR`, not stream `PROTOCOL_ERROR` or `REFUSED_STREAM`. `V3-9113-015` records the previously demonstrated nonzero-stream WINDOW_UPDATE(0) scope failure at the general stream-error requirement level; it shares the cause already counted under `V3-9113-026`. `V3-9113-029` is Nonconformant because an active-stream `SETTINGS_INITIAL_WINDOW_SIZE` overflow produced stream RST_STREAM `FLOW_CONTROL_ERROR` rather than the required connection error. Contiguous and fragmented delivery agreed. `V3-9113-011`, `014`, `028`, and `031` remain Unverified for the bounded reasons in `batch-e-evidence-review.md`.

### Batch F HTTP/2 output, CONNECT, TLS, and resources reconciliation

Batch F resolved all nine assigned records. `V3-9113-003`, `036`, `047`,
`049`, `050`, and `060` are Conformant on the tested Node.js 22.15.0 stack.
`V3-9113-053` is Nonconformant because post-preface TLS 1.2 renegotiation
received connection `INTERNAL_ERROR`, not required `PROTOCOL_ERROR`.
`V3-9113-056` is Nonconformant at SHOULD NOT level because an explicitly
enabled prohibited TLS 1.2 cipher negotiated h2. Corrected MAY record
`V3-9113-057` is Optional not implemented. See `batch-f-evidence-review.md`.

### Quality-review corrections

The focused quality follow-up added three records while preserving every prior
V3 identifier: `V3-9112-042`, `V3-9113-061`, and `V3-9113-062`. It also
reclassified `V3-9110-098` after the HTTP/2 405 reproduction, corrected
`V3-9113-059` to the RFC's actual field-block state-consistency obligation,
and narrowed bounded evidence claims without changing the classifications of
`V3-9112-001`, `V3-9112-002`, `V3-9113-003`, and `V3-9113-060`. The new TLS
records and corrected `V3-9113-059` remain Unverified; no inference is made
from cipher negotiation alone or from one unsuccessful renegotiation attempt.

## Remaining ambiguities

- HTTP/2 evidence now establishes selected malformed-frame, stream-state, flow-control, response-output, CONNECT, TLS, and resource-limit behavior and ten requirement-level nonconformities on the assessed Node 22.15.0 stack. These rows share fewer underlying causes; they are not ten independent Achieve defects. Broad connection-error, malformed-request, and connection receive-window rows remain Unverified where the focused campaigns did not cover their complete scope.
- Application-authored response fields and direct response ownership can make some obligations shared with servlet authors; V3 records responsibility without treating hypothetical application misuse as a core violation.
- Optional capabilities remain inventoried only when their presence or absence affects a concrete protocol condition; pure descriptive grammar and unsupported RFC text were removed.

## Traceability and validation
`requirements-v2-v3-mapping.csv` is authoritative for V2 traceability. It records Retained, Corrected, Split, Merged, or Removed for all 209 V2 IDs. `V3-9113-061` has no V2 predecessor and is documented as a newly discovered obligation. V3 identifiers are unique and grouped by RFC. Counts above are generated from the V3 records.

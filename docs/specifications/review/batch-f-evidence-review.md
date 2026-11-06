# Batch F HTTP/2 Output, CONNECT, TLS, and Resource Evidence Review

## Scope and method

This review covers the nine Batch F records from the 208-record V3 inventory:
`V3-9113-003`, `036`, `047`, `049`, `050`, `053`, `056`, `057`, and
`060`. The normative source was RFC 9113 sections 4.1, 8.2.2, 8.3.2,
8.5, 9.2.1, 9.2.2, and 10.5.2.

Existing repository evidence was reviewed first. Focused local probes then
used Node.js 22.15.0, nghttp2 1.64.0, and OpenSSL 3.0.16 on Windows. They
captured raw h2c frames for CONNECT and sender reserved-bit observations,
used Node's HTTP/2 compatibility API for response-field and informational
response behavior, forced TLS 1.2 for cipher and renegotiation checks, and
ran a bounded stream/control-operation exercise. Standalone Node and Achieve
were compared where Achieve delegates protocol behavior to Node/nghttp2.
Temporary applications and probe files were removed after use.

This is bounded evidence about the tested runtime, not a claim that a finite
corpus proves every possible output sequence or resource-exhaustion pattern.

## Inventory corrections

Three Batch F ledger rows overstated RFC 9113:

- Section 9.2.2 says TLS 1.2 deployments **SHOULD NOT** use a prohibited
  cipher suite; `V3-9113-056` incorrectly said MUST NOT.
- Section 9.2.2 says an endpoint **MAY** generate `INADEQUATE_SECURITY` when
  a prohibited cipher is negotiated; `V3-9113-057` incorrectly made this a
  mandatory termination rule.
- Section 10.5.2 says implementations **SHOULD** track abuse-prone features
  and set limits; `V3-9113-060` incorrectly said MUST.

The identifiers and V2 mappings are retained. `V3-9113-053` was also made
precise: after the client connection preface, a TLS 1.2 renegotiation attempt
must be treated as a connection `PROTOCOL_ERROR`; the narrow client-
certificate exception is available only before the preface.

## Requirement decisions

| ID | Exact obligation and evidence | Responsible layer | Decision and limitations |
|---|---|---|---|
| V3-9113-003 | Section 4.1 requires recipients to ignore the reserved stream-identifier bit and senders to leave it unset. Existing P01 sent a valid request with the reserved bit set and received a normal response. Batch F decoded server SETTINGS, SETTINGS ACK, HEADERS, RST_STREAM, and GOAWAY frames; every raw stream field had the reserved bit clear. | Node/nghttp2 framing used by Achieve | **Conformant.** Both directions are directly exercised across all server frame types observed in the focused campaigns. The sender observation remains a bounded corpus, but framing is centralized in nghttp2 rather than application-generated. |
| V3-9113-036 | Section 8.2.2 prohibits generating `Transfer-Encoding`. Existing h2c/h2 static-length tests find no such field. In Batch F, setting `transfer-encoding: chunked` through the compatibility response API caused `ERR_HTTP2_INVALID_CONNECTION_HEADERS` at serialization; no field section reached the wire. An Achieve servlet attempt also produced no HTTP/2 response field section containing the field. | Node HTTP/2 serializer; Achieve/application selects semantic fields | **Conformant.** Ordinary and attempted prohibited output establish serializer enforcement. The application attempt terminates without a normal response, which is operationally undesirable but does not generate the prohibited field and is outside this record. |
| V3-9113-047 | Section 8.3.2 permits a server to send zero or more informational responses before exactly one final response. A standalone compatibility-response control sent 100 and 103 HEADERS, both with `END_HEADERS` but not `END_STREAM`, followed by exactly one final 200 and DATA `final`. Achieve uses the same response type. | Node HTTP/2 serializer and application response API | **Conformant** for the implemented optional capability. The investigation plan incorrectly described this MAY capability as a MUST NOT rule; no forbidden informational sequence was observed. |
| V3-9113-049 | Classic CONNECT requires `:method CONNECT` and `:authority`. Existing Achieve coverage accepts the correctly formed request and returns its intentional unsupported-method response. A raw valid control reached the standalone request handler; omitting `:authority` produced stream RST_STREAM `PROTOCOL_ERROR`. Node's client API independently rejects creation of a CONNECT request without authority. | Node/nghttp2 validation; Achieve handles the validated request | **Conformant.** Positive and malformed controls exercise the required fields. |
| V3-9113-050 | Classic CONNECT must omit `:scheme` and `:path`. Raw requests containing either field received stream RST_STREAM `PROTOCOL_ERROR`; the connection-level parser did not accept them as application requests. Node's client API also rejects either combination synchronously. | Node/nghttp2 validation | **Conformant.** Both prohibited pseudo-fields are directly exercised. |
| V3-9113-053 | Section 9.2.1 requires TLS 1.2 renegotiation after the connection preface to be treated as a connection `PROTOCOL_ERROR`. After TLS 1.2 negotiated `h2`, the probe sent the preface and SETTINGS, then initiated renegotiation. The server closed with GOAWAY `INTERNAL_ERROR` (`0x2`), not `PROTOCOL_ERROR` (`0x1`). | Node/OpenSSL/nghttp2 secure HTTP/2 endpoint; Achieve passes server options through | **Nonconformant** on Node 22.15.0. Rejection occurred at connection scope but with the wrong mandatory HTTP/2 error code. The pre-preface client-certificate exception was not invoked. |
| V3-9113-056 | Corrected section 9.2.2 guidance says TLS 1.2 deployments SHOULD NOT use suites on the prohibited list. With both peers explicitly configured for `AES128-SHA:@SECLEVEL=0`, the endpoint negotiated TLS 1.2, ALPN `h2`, and `TLS_RSA_WITH_AES_128_CBC_SHA`, a prohibited suite. The allowed control negotiated `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`. | Deployment configuration plus Node/OpenSSL; Achieve passes TLS options through | **Nonconformant** at SHOULD level for the supported configurable endpoint. Default OpenSSL policy is safer, but Achieve permits a configuration that violates the recommendation and does not apply the HTTP/2 cipher blacklist. |
| V3-9113-057 | Corrected section 9.2.2 language permits, but does not require, `INADEQUATE_SECURITY` when a prohibited suite is negotiated. The prohibited-suite control established an h2 session and received SETTINGS rather than GOAWAY `INADEQUATE_SECURITY`. | Node/nghttp2 secure HTTP/2 endpoint | **Optional not implemented.** Absence of this permitted error is not nonconformance. The connection later closed only because the separate renegotiation check was run. |
| V3-9113-060 | Corrected section 10.5.2 guidance says implementations SHOULD track abuse-prone features and set limits. Node 22 documents and applies finite defaults including 10 MiB session memory, 128 header pairs, 32 settings per frame, 100 rejected streams, 1000 invalid frames, and 10 outstanding pings. The bounded exercise completed 200 requests, limited 90 of 100 simultaneously initiated pings beyond the 10-operation client limit, and a subsequent health request succeeded. | Node/nghttp2 resource controls inherited by Achieve defaults | **Conformant** to the recommendation to track and limit resources. This does not prove immunity to every denial-of-service strategy; it establishes concrete, documented bounds and recovery rather than inferring safety from successful traffic. |

## Wire observations

- Valid classic CONNECT produced normal response HEADERS. Missing authority,
  forbidden scheme, and forbidden path each produced stream RST_STREAM
  `PROTOCOL_ERROR` (`0x1`).
- All decoded Batch F output frames had a zero reserved stream bit. The frame
  sample included SETTINGS, SETTINGS ACK, HEADERS, RST_STREAM, and GOAWAY;
  prior campaigns supply DATA and WINDOW_UPDATE observations.
- Informational responses used HEADERS flags `0x4` (`END_HEADERS`) and the
  final 200 used a separate final field section; no informational HEADERS had
  `END_STREAM`.
- Post-preface TLS 1.2 renegotiation produced connection GOAWAY
  `INTERNAL_ERROR`, confirming rejection but the wrong required code.
- Both allowed and prohibited forced TLS 1.2 suites negotiated ALPN `h2`.

## Classification effect

All nine Batch F records are resolved. Six become Conformant, two become
Nonconformant, and one becomes Optional not implemented. The HTTP/2 subtotal
therefore changes from 34 Conformant, 8 Nonconformant, 15 Unverified,
3 Not applicable, and 0 Optional not implemented to 40, 10, 6, 3, and 1.

The overall 208-record inventory changes from 146 Conformant,
12 Nonconformant, 20 Unverified, 22 Not applicable, and 8 Optional not
implemented to 152, 14, 11, 22, and 9. No record was added or removed.

## Remaining limitations

- Results describe Achieve 3.0.6 on Node.js 22.15.0/nghttp2 1.64.0/OpenSSL
  3.0.16 and are not generalized to later runtimes.
- The prohibited cipher required explicit opt-in and lowered OpenSSL security
  policy. The finding concerns the endpoint's supported configuration, not
  the safer default cipher selection.
- The resource result establishes concrete built-in limits, not universal
  resistance to resource exhaustion.
- No application or existing test file was changed, and no upstream issue was
  filed.

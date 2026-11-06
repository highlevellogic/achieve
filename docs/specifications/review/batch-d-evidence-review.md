# Batch D HTTP/1.1 framing and TLS closure evidence review

## Scope and environment

This review covers the seven Batch D records assigned in
`unverified-requirements-plan.md`. It evaluates Achieve 3.0.6 on Node.js
22.15.0 (linked OpenSSL 3.0.16) on Windows. TLS record observation used the
locally available OpenSSL 3.5.7 command-line client. The same bounded cases
were run against an Achieve server and a standalone Node server to identify
the responsible layer.

Existing implementation, verifier, Batch B, request-target, and framing
evidence was reviewed before probing. The temporary probe used raw TCP for
HTTP/1.1, raw byte field values, deliberately fragmented chunk lines,
malformed controls, and OpenSSL TLS record diagnostics. Temporary application
files and the probe were removed after execution; the existing repository test
certificate was reused and not modified.

## Decisions

| ID | Requirement, evidence, and responsibility | Decision |
|---|---|---|
| V3-9112-001 | RFC 9112 §§2.1-2.3 define HTTP/1.1 message grammar and version syntax. Node serializes ordinary Achieve responses; Achieve's direct CONNECT template uses an explicit HTTP/1.1 status line, CRLF fields, Content-Length, and close semantics. Batch D validated byte-level status-line grammar, field-name syntax, CRLF delimiters, and Content-Length or terminal-chunk framing for representative 200, 404, parser-error, and HTTP/1.0-request responses. Existing response-completion, static-length, CONNECT, and status/body evidence covers principal exceptional paths. | **Conformant** for Achieve core and supported response APIs. Arbitrary bytes written directly by application code to a socket remain application responsibility. |
| V3-9112-002 | Section 2.2 requires recipients to parse messages as octets in a US-ASCII superset, not as an undifferentiated Unicode stream. A raw field value containing `0x80 0xff 0xc2 0x85` reached Achieve and standalone Node as the exact code-unit sequence `128,255,194,133`; `0xc2 0x85` was not UTF-8-decoded into one character. A high-bit octet in a field name was rejected with 400. Node's parser owns message delineation before Achieve dispatch. | **Conformant** on Node 22.15.0. The observations directly establish byte-oriented boundary parsing and one-octet exposure for field-value bytes. |
| V3-9112-017 | Section 6.1 says a server receiving a request transfer coding it does not understand **SHOULD** respond 501. `Transfer-Encoding: frobnicate, chunked` isolated this condition while retaining valid final chunk framing. Achieve and standalone Node returned 200, removed chunk framing, and delivered the remaining bytes without decoding `frobnicate`. A chunked-only request succeeded as a valid control. An unknown final coding returned 400 under the independent §6.3 rule that chunked must be final, confirming why that older observation could not decide this record. Achieve has no transfer-coding decoder or registration mechanism. | **Nonconformant** at SHOULD level. No documented reason for omitting 501 was identified. The behavior is inherited from Node's HTTP parser but is observable at the supported Achieve endpoint. |
| V3-9112-032 | Section 7.1.1 requires recipients to ignore unrecognized chunk extensions. The probe fragmented a chunk-size line across TCP writes and supplied token, escaped quoted-string, valueless, and terminal-chunk extensions. Both endpoints ignored the extensions and delivered exactly `DATAXYZ`; an extension-free chunked request delivered `DATA` as the control. The existing request-input verifier also passed. | **Conformant.** Node owns extension parsing before Achieve receives decoded content. The separate non-normative extension-length advice was not assessed. |
| V3-9112-033 | Section 7.1.2 prohibits merging retained trailer fields into headers unless their definitions expressly permit safe merging. Batch B already placed a trailer only in `trailers`/`rawTrailers`. Batch D independently sent `Authorization` in both sections and trailer-only `X-Trailer`: headers retained `Basic head`; trailers retained `Basic tail` and `tail-value`; `rawTrailers` preserved both lines; no trailer value appeared in headers. Standalone Node matched. | **Conformant.** Node stores retained trailers separately and Achieve performs no merge. Discarding trailers would also be permitted by this section. |
| V3-9112-039 | Section 9.8 says servers **MUST** attempt to initiate TLS closure-alert exchange before closing. With `Connection: close`, OpenSSL record diagnostics captured the Achieve HTTPS server's `close_notify` after the complete HTTP response and exited normally. The standalone Node control did the same. | **Conformant** for Node 22.15.0/OpenSSL 3.0.16. The record observation assigns implementation responsibility to Node/OpenSSL rather than Achieve application logic. |
| V3-9112-040 | Section 9.8 says servers **SHOULD** be prepared for an incomplete client close. After receiving a complete keep-alive response, one Node TLS client called `destroy()` and a separate OpenSSL client was forcibly terminated before orderly TLS shutdown. Achieve remained operational and returned a complete 200 health response after each abort; no uncaught server failure occurred. Standalone Node matched. | **Conformant** for the exercised incomplete-close conditions. This establishes graceful handling, not an exhaustive resource-leak result under sustained hostile aborts. |

## Wire observations

| Probe | Achieve 3.0.6 | Standalone Node 22.15.0 | Primary layer |
|---|---|---|---|
| Static success / missing resource / HTTP/1.0 request | Valid HTTP/1.1 response grammar and framing | Valid HTTP/1.1 response grammar and framing | Node serializer; Achieve selects representation/status |
| High-bit field-value octets | Exact `128,255,194,133` code units | Identical | Node parser |
| High-bit field-name octet | 400 | 400 | Node parser |
| `Transfer-Encoding: chunked` | 200; `DATA` delivered | Identical | Node parser |
| `Transfer-Encoding: frobnicate` | 400 | 400 | Node parser, final-coding framing rule |
| `Transfer-Encoding: frobnicate, chunked` | 200; bytes delivered without `frobnicate` decoding | Identical | Node parser; confirmed §6.1 issue |
| Fragmented unknown chunk extensions | 200; `DATAXYZ` delivered | Identical | Node parser |
| Header and trailer Authorization controls | Kept separate | Identical | Node parser |
| Server-initiated HTTPS close | TLS `close_notify` observed | TLS `close_notify` observed | Node/OpenSSL |
| Two incomplete client TLS closes | Subsequent HTTPS health returned 200 | Same | Node/OpenSSL |

## Existing test execution

`node tests/request_input/verify.js` passed all buffered JSON/form, streamed
XML/SAX, size-limit, malformed-input, abort-survival, and health checks. Batch
B trailer evidence and the established response-completion, static-length,
CONNECT, and request-target suites were reused rather than rewritten.

## Classification reconciliation

Batch D changes six records from Unverified to Conformant and one from
Unverified to Nonconformant. All seven RFC 9112 records assigned to the batch
are resolved; no RFC 9112 record remains Unverified.

| RFC | Conformant | Nonconformant | Unverified | Not applicable | Optional not implemented | Total |
|---|---:|---:|---:|---:|---:|---:|
| RFC 9110 | 81 | 2 | 5 | 9 | 3 | 100 |
| RFC 9111 | 0 | 0 | 0 | 3 | 4 | 7 |
| RFC 9112 | 31 | 2 | 0 | 7 | 1 | 41 |
| RFC 9113 | 28 | 5 | 24 | 3 | 0 | 60 |
| **Overall** | **140** | **9** | **29** | **22** | **8** | **208** |

Before Batch D, the totals were 134 Conformant, 8 Nonconformant, 36
Unverified, 22 Not applicable, and 8 Optional not implemented. The inventory
remains 208 unique records.

## Limitations

- `V3-9112-001` is a protocol-specific application of RFC 9110 §2.2's
  generic sender ABNF obligation to the message grammar defined by RFC 9112;
  its wording is not a verbatim standalone MUST in RFC 9112 §2.2. The V2
  validation already records that inherited normative basis, so the row was
  retained rather than treated as a new independent RFC 9112 keyword.
- Results describe the tested Node 22.15.0 and Windows TLS stack. Node or
  OpenSSL changes require reassessment.
- The sender-grammar conclusion covers Achieve core and supported response
  APIs, not arbitrary application writes to the underlying socket.
- TLS abort checks establish continued correct service after bounded
  incomplete closes; they are not a denial-of-service or long-duration
  resource audit.
- The unrecognized transfer-coding result is a missed SHOULD recommendation,
  not a MUST-level framing failure. No upstream issue was filed.

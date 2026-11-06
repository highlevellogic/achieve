# Consolidated Quality Review of the Achieve 3.0.6 HTTP Assessment

## Executive summary

This quality-control review examined all 208 V3 records, the 209-row V2-to-V3
mapping, the consolidation and summary documents, Batch A-F reports, and the
focused HTTP/1.1 and HTTP/2 investigations against RFC 9110, RFC 9111,
RFC 9112, and RFC 9113.

The recorded totals are internally consistent:

| Classification | Count |
|---|---:|
| Conformant | 152 |
| Nonconformant | 14 |
| Unverified | 11 |
| Not applicable | 22 |
| Optional not implemented | 9 |
| **Total** | **208** |

All IDs are unique; every RFC URL has the expected RFC Editor section form;
every V3 row has V2 traceability; all 209 V2 rows occur exactly once in the
mapping; 207 are represented by V3 source references and the remaining two
are explicitly documented removals (`V2-C006` and `V2-H201`). All mapping
targets exist. No arithmetic or identifier defect was found.

The assessment is useful and generally defensible as a bounded assessment of
Achieve 3.0.6 on Node.js 22.15.0. It should not yet be described as an
exhaustive inventory of every normative sentence in the four RFCs. One clear
mandatory RFC 9113 cipher-support obligation is absent, several broad records
combine multiple obligations, and a small group of Conformant rows relies on
evidence narrower than their wording.

No substantive classification was changed in this review. A later exact-text
follow-up corrected this review's initial clerical treatment of
`V3-9110-088`: both `Content-Type` and `Last-Modified` are beyond the preceding
section 15.3.7 required field set in the tested single-part If-Range 206.

## Severity-ranked findings

### High: inventory coverage and classification concerns

#### Q1. Missing RFC 9113 section 9.2.2 mandatory cipher support record

RFC 9113 section 9.2.2 requires TLS 1.2 deployments to support
`TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` with the P-256 curve. The V3 ledger
contains the prohibited-suite recommendation (`V3-9113-056`) and optional
`INADEQUATE_SECURITY` behavior (`V3-9113-057`), but no record for this distinct
MUST-level interoperability requirement.

The Batch F allowed-suite control negotiated that suite, but it did not
separately establish the required P-256 curve. Recommended action: add a
traceable record only after deciding how a newly discovered obligation affects
the fixed 208-row inventory and mapping. A focused TLS 1.2 curve/cipher capture
would be needed before classification. This review does not add the row.

#### Q2. `V3-9110-098` is probably applicable and may be Nonconformant

The row classifies the 405 `Allow` requirement as Not applicable because no
Achieve-generated 405 path was originally found. Existing CONNECT coverage
demonstrates that the supported HTTP/2 endpoint generates 405 for classic
CONNECT. The Batch F capture showed only `:status` and `date`, with no `allow`
field. If that capture is preserved/repeated as focused evidence, RFC 9110
section 15.5.6's MUST to generate `Allow` is violated.

Responsibility appears to be Node's HTTP/2 compatibility layer before normal
Achieve CONNECT handling, but the complete supported endpoint remains the
conformance subject. Recommended action: preserve a focused h2/h2c header
capture and then propose `V3-9110-098` from Not applicable to Nonconformant.
No classification is changed here because the current committed evidence file
asserts only status/body and does not retain the response fields.

#### Q3. Several records combine or omit distinct normative obligations

- `V3-9113-053` now accurately records the required post-preface
  `PROTOCOL_ERROR`, but RFC 9113 section 9.2.1 also states that TLS 1.2
  renegotiation MUST be disabled. The configuration prohibition and reaction
  to an attempt should either be separate records or explicitly identified as
  two clauses in one record.
- `V3-9112-041` combines a client SHOULD about determining completeness with
  a client MUST NOT about accepting an unframed, close-delimited response
  after incomplete TLS closure, while its normative-level cell says only
  MUST. Splitting would make level and evidence traceable.
- `V3-9113-007` is an umbrella stream-state obligation that overlaps specific
  records `008`, `009`, `012`, `015`, `020`, and others. A demonstrated
  violation makes the umbrella Nonconformant, but counting both umbrella and
  specific rows inflates requirement-level failure counts relative to root
  causes. The summary already warns about shared causes; the inventory should
  eventually define whether umbrella rows are retained as composites.
- `V3-9113-014` and `V3-9113-031` similarly cover broad families whose
  individual cases have separate records or evidence.

These are inventory-design corrections, not clerical edits, and require
approval before splitting or changing totals.

### Medium: Conformant conclusions needing tighter evidence language

The following classifications have meaningful supporting evidence, but their
wording can be read more broadly than the evidence permits:

| IDs | Concern | Recommended treatment |
|---|---|---|
| `V3-9110-007`, `012`, `017`, `019` | Representative unknown-field, whitespace, final-response, and trailer cases do not prove every field definition or request path. | Retain only with explicit “tested core paths/field classes” scope, or split into tested cases. |
| `V3-9112-001`, `002` | Bounded wire captures establish representative grammar and octet parsing, not every production in the HTTP/1.1 grammar. | Narrow the record/evidence claim or return the broad composite to Unverified. |
| `V3-9113-003` | Receiver behavior and several emitted frame types are captured, but not every possible sender frame sequence. | Retain as Node/nghttp2 centralized-framing evidence while keeping the stated bounded limitation. |
| `V3-9113-059` | The rationale cites a finite field-pair limit, while section 10.5.1 concerns limiting field-section resource use, including compressed/decompressed size. There is no focused wire test in the ledger. | Add authoritative Node 22 byte/memory-limit evidence or a bounded oversized-field-section test before treating this as fully established. |
| `V3-9113-060` | Documented Node limits are strong evidence, but the Batch F 10-ping result primarily exercised the client-side outstanding-ping limit, not the server's exposure to inbound control-frame abuse. | Retain the SHOULD-level result based on documented server defaults, but remove any implication that the ping observation proves server-side DoS resistance. |

Sixty-eight Conformant rows use a common rationale template. The template is
not itself an error, but it obscures which exact condition each test proves.
Future maintenance should prefer requirement-specific rationale, especially
for broad sender/recipient rules.

### Low: terminology and classification-category consistency

- `V3-9110-092` is Not applicable because Achieve never sends a multipart 206;
  “Optional not implemented” would also describe the capability. The current
  choice is defensible because the MUST is conditional on actually transferring
  multiple parts, but category policy should be stated consistently.
- `V3-9110-030`, `V3-9110-044`, and `V3-9112-025` are mandatory rules under a
  successful CONNECT condition, categorized Optional not implemented because
  successful CONNECT tunneling itself is optional and absent. This is a sound
  use of the category, provided readers understand that the MUST is not
  optional once its condition is reached.
- Rows with a blank normative-level cell generally capture normative protocol
  algorithms or definitions without a local BCP 14 keyword. They are not
  automatically defects, but the ledger should distinguish “normative prose”
  from an accidentally omitted keyword.

## Review of all 14 Nonconformant records

| ID | RFC obligation | Observed behavior and evidence | Responsible layer | Newer upstream status | Achieve action |
|---|---|---|---|---|---|
| `V3-9110-086` | §15.3.6 **MUST NOT** generate content in 205. | Batch B: HTTP/1.1 sent 14 content octets and Content-Length; h2c suppressed them. | Achieve completion plus Node HTTP/1 serializer. | Not assessed. | Appropriate: suppress returned content for 205 before serialization, with transport tests. |
| `V3-9110-088` | §15.3.7 **SHOULD NOT** repeat unnecessary representation metadata on an If-Range 206. | Batch B: `Content-Type` and `Last-Modified` repeated on HTTP/1.1 and h2c; §15.3.7.1 does not expressly require Content-Type for a single-part 206. | Achieve static/media metadata selection. | Not upstream-dependent. | Appropriate: omit unnecessary representation fields on the If-Range path, subject to policy review. |
| `V3-9112-006` | §3 **MUST** return 414 when the request-target exceeds the accepted length. | Focused H105 report: long target receives 431 because Node reports shared `HPE_HEADER_OVERFLOW`. | Node HTTP/1 parser; complete Achieve endpoint. | Still reproduced on Node 24.22.1. | Prefer upstream parser distinction; an Achieve pre-parser would be disproportionate. |
| `V3-9112-017` | §6.1 **SHOULD** return 501 for an unrecognized request transfer coding. | Batch D: `frobnicate, chunked` is accepted and decoded as chunked; application gets remaining coded bytes. | Node HTTP parser. | Not tested on newer Node. | Prefer upstream; do not add a second HTTP parser solely for this recommendation. |
| `V3-9113-007` | §5.1 **MUST** enforce state-dependent permitted frames/errors. | P-series and five-findings report contain multiple wrong code/scope outcomes. | Node 22/nghttp2. | Several connection-code substitutions are fixed in Node 24; stream WINDOW_UPDATE scope remains. | Upstream/runtime upgrade; no Achieve framing workaround. |
| `V3-9113-008` | §5.1.1 **MUST** use/enforce client odd stream IDs; bad parity is connection PROTOCOL_ERROR. | Node 22 sends GOAWAY INTERNAL_ERROR for stream 2. | Node/nghttp2. | Fixed in tested Node 24.22.1. | Upgrade runtime when supported. |
| `V3-9113-012` | §5.1.2 **MUST** use stream PROTOCOL_ERROR or REFUSED_STREAM above advertised concurrency. | Batch E E01/E01-F: connection GOAWAY INTERNAL_ERROR. | Node 22/nghttp2. | Not tested on newer Node. | Upstream/runtime fix; not Achieve application logic. |
| `V3-9113-015` | §5.4.2 **MUST** send RST_STREAM for a stream error. | WINDOW_UPDATE(0) on live stream receives connection GOAWAY. | nghttp2/Node. | Scope defect persisted in tested Node 24.22.1. | Upstream nghttp2/Node correction. |
| `V3-9113-019` | §6.5.2 **MUST** use the specified connection error for invalid SETTINGS values. | Node 22 substitutes INTERNAL_ERROR for invalid ENABLE_PUSH/MAX_FRAME_SIZE. | Node 22/nghttp2 callback closure. | Fixed in tested Node 24.22.1. | Runtime upgrade; no Achieve workaround. |
| `V3-9113-020` | §6.6 server **MUST** treat received PUSH_PROMISE as connection PROTOCOL_ERROR. | Node 22 sends INTERNAL_ERROR. | Node 22/nghttp2. | Fixed in tested Node 24.22.1. | Runtime upgrade. |
| `V3-9113-026` | §6.9 increment zero is **MUST**-level PROTOCOL_ERROR at applicable scope. | Node 22 uses INTERNAL_ERROR; stream case also uses GOAWAY instead of RST_STREAM. | Node/nghttp2. | Node 24 fixes connection error code but not stream scope. | Upstream correction; no application workaround. |
| `V3-9113-029` | §6.9.2 **MUST** adjust active windows; overflow is connection FLOW_CONTROL_ERROR. | Batch E E10/E11: stream RST_STREAM FLOW_CONTROL_ERROR instead. | Node 22/nghttp2. | Not tested on newer Node. | Upstream/runtime investigation. |
| `V3-9113-053` | §9.2.1 post-preface TLS 1.2 renegotiation **MUST** be connection PROTOCOL_ERROR. | Batch F: connection GOAWAY INTERNAL_ERROR. | Node/OpenSSL/nghttp2 secure endpoint. | Not tested on newer Node. | Prefer upstream/runtime correction; Achieve only passes secure-server options. |
| `V3-9113-056` | §9.2.2 TLS 1.2 endpoints **SHOULD NOT** negotiate prohibited suites. | Batch F: explicitly configured `TLS_RSA_WITH_AES_128_CBC_SHA` negotiated TLS 1.2 with ALPN h2. | OpenSSL/Node configuration exposed through Achieve options. | Not tested on newer Node. | An Achieve cipher-policy guard is possible but changes TLS option pass-through; decide against runtime-upgrade and compatibility costs. |

The fourteen rows represent fewer than fourteen independent defects. In
particular, `007`, `015`, and `026` overlap; `008`, `019`, and `020` share the
Node 22 error-code substitution; and `015`/`026` share the nghttp2
WINDOW_UPDATE scope behavior.

## Review of all 11 Unverified records

| ID | Why unresolved | Realistic next evidence |
|---|---|---|
| `V3-9110-001` | Universal sender ABNF rule is broader than a finite response corpus. | Split into concrete generated elements or perform serializer/source audit by element. A single probe cannot resolve the composite. |
| `V3-9110-002` | “Syntax allowed only for another role” spans many role-specific constructs. | Inventory role-specific sender prohibitions, then test each; otherwise retain Unverified. |
| `V3-9110-003` | Defensive parsing is a broad SHOULD without a finite acceptance set. | Define representative malformed/marginal families and report bounded conformance rather than universal conformance. |
| `V3-9110-004` | Requires comparing accepted lengths with every same-element value the endpoint generates. | Property-based length comparison for identified generated elements is practical after decomposing the record. |
| `V3-9110-005` | Semantic interpretation is open-ended across all received elements. | Split by concrete fields/methods; the composite is not realistically provable by focused testing. |
| `V3-9113-005` | Receiver contiguous-block behavior is tested; sender multi-frame field-block output is not captured. | Generate an oversized response field block with concurrent stream traffic and decode HEADERS/CONTINUATION ordering. Practical. |
| `V3-9113-011` | No dynamic reduction below the count of already-open streams was exercised. | Standalone Node/Achieve session test that opens held streams, lowers advertised maximum, and observes close-or-complete behavior. Practical but requires controlled session API access. |
| `V3-9113-014` | Broad GOAWAY SHOULD covers many connection-error causes; tests cover only selected families. | Split by error family or retain composite Unverified. More finite probes cannot establish all cases. |
| `V3-9113-028` | Deterministic connection receive-window exceedance was not achieved through supported interfaces. | Raw DATA with deliberately controlled connection window and held application consumption, or authoritative nghttp2 evidence. Specialized but feasible. |
| `V3-9113-031` | “Malformed request” encompasses all section 8.1.1 conditions; many but not all were probed. | Split into defined malformed-message families and map existing P-series evidence. |
| `V3-9113-034` | Transfer-Encoding is covered, but sender attempts for all connection-specific fields and representative error paths are not. | Attempt Connection, Keep-Alive, Proxy-Connection, Upgrade, and Transfer-Encoding through supported response APIs; capture h2c/h2 output. Practical. |

Five RFC 9110 composites and two broad RFC 9113 composites are structurally
difficult to prove as written. Decomposition is more defensible than an
ever-growing sample followed by a universal Conformant label.

## Not applicable and Optional not implemented review

### Not applicable (22)

The following groups are correctly outside Achieve's assessed origin-server
role or tested condition:

- Client-only generation/retry/response-receipt duties:
  `V3-9110-040`, `045`; `V3-9112-008`, `011`, `012`, `041`;
  `V3-9113-024`, `032`.
- Proxy/intermediary-only duties: `V3-9110-055`, `V3-9112-013`,
  `V3-9113-058`.
- Cache-only duties: `V3-9111-001`, `002`.
- False clockless conditions: `V3-9110-051`, `V3-9111-007`.
- Core does not select the conditional application status/capability:
  `V3-9110-052`, `092`, `097`.
- Traceability placeholder with no RFC 9110 normative requirement:
  `V3-9110-099`.

`V3-9110-098` is the material concern described above. The classification
should not remain Not applicable if the supported Node/Achieve endpoint itself
generates 405.

### Optional not implemented (9)

- Successful CONNECT-dependent rules `V3-9110-030`, `044`, and
  `V3-9112-025` are correctly dormant because tunneling is not implemented.
- Optional one-part multipart range generation `V3-9110-093` is absent and
  permitted.
- RFC 9111 optional directive forms `V3-9111-003` through `006` are not
  generated by Achieve core; applications authoring them own their syntax.
- `V3-9113-057` correctly records a MAY-level `INADEQUATE_SECURITY` behavior
  that is absent.

None of these labels makes a conditional MUST optional once its triggering
feature is implemented.

## V2-to-V3 traceability and consolidation

- V2 rows: 209, unique.
- Mapping actions: 180 Retained, 20 Corrected, 3 Split, 4 Merged, 2 Removed.
- V3 rows: 208, unique.
- Missing V3 mapping targets: 0.
- V3 rows without V2 source references: 0.
- V2 rows not represented by a V3 source: exactly the two documented removals.
- Exact duplicate `(RFC, section, requirement)` V3 rows: 0.

The numerical mapping is sound. Semantic overlap remains in umbrella/specific
HTTP/2 rows and in successful CONNECT field prohibitions from different RFC
sections. The CONNECT overlap reflects distinct source obligations; the
HTTP/2 umbrella overlap should be explicitly documented as composite coverage
if retained.

## Clerical correction superseded by exact-text follow-up

The initial clerical correction in this review was subsequently corrected
without changing the classification:

- `V3-9110-088`, Batch B, the consolidation, and the summary now accurately
  record both repeated `Content-Type` and `Last-Modified`. The Nonconformant
  SHOULD-level classification is unchanged.

## Recommended corrective sequence

1. Preserve focused evidence for HTTP/2-generated 405 fields and decide
   `V3-9110-098` before changing its classification.
2. Decide whether to add the missing RFC 9113 section 9.2.2 mandatory cipher
   support record and how to preserve the 208-row traceability baseline.
3. Split compound/composite records `V3-9112-041`, `V3-9113-053`, `007`,
   `014`, and `031`, or explicitly label them composites whose counts overlap
   specific records.
4. Tighten evidence for `V3-9113-059` and revise `V3-9113-060` wording so
   client-side ping limiting is not presented as server-side proof.
5. Resolve the practical Unverified sender checks `V3-9113-005` and `034`
   before expanding into the broad RFC 9110 composites.
6. Keep all runtime-layer findings explicitly pinned to Node.js 22.15.0 until
   later runtimes are independently assessed.

No Achieve implementation/test change, public specification-page change,
classification change, upstream filing, commit, or push was performed.

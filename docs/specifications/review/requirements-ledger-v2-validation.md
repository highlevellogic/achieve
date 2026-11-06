# Requirements Ledger V2 Validation

## Summary

The reconstructed ledger contains **209** requirements-only records. No implementation conformance classifications were imported; every row is marked Not yet reassessed.

## Counts by RFC

| RFC | Records |
|---|---:|
| RFC 9110 | 100 |
| RFC 9111 | 8 |
| RFC 9112 | 39 |
| RFC 9113 | 62 |

## Coverage by major section

| RFC major section | Records |
|---|---:|
| RFC 9110 section 10 | 6 |
| RFC 9110 section 11 | 1 |
| RFC 9110 section 12 | 3 |
| RFC 9110 section 13 | 23 |
| RFC 9110 section 14 | 7 |
| RFC 9110 section 15 | 15 |
| RFC 9110 section 2 | 5 |
| RFC 9110 section 3 | 1 |
| RFC 9110 section 5 | 10 |
| RFC 9110 section 6 | 4 |
| RFC 9110 section 7 | 3 |
| RFC 9110 section 8 | 15 |
| RFC 9110 section 9 | 7 |
| RFC 9111 section 3 | 1 |
| RFC 9111 section 4 | 1 |
| RFC 9111 section 5 | 6 |
| RFC 9112 section 2 | 4 |
| RFC 9112 section 3 | 8 |
| RFC 9112 section 5 | 2 |
| RFC 9112 section 6 | 13 |
| RFC 9112 section 7 | 5 |
| RFC 9112 section 9 | 7 |
| RFC 9113 section 10 | 3 |
| RFC 9113 section 3 | 1 |
| RFC 9113 section 4 | 6 |
| RFC 9113 section 5 | 9 |
| RFC 9113 section 6 | 15 |
| RFC 9113 section 8 | 21 |
| RFC 9113 section 9 | 7 |

## Counts by normative basis

| Basis | Records |
|---|---:|
| explicit BCP 14 keyword | 185 |
| explicit BCP 14 keyword plus normative grammar | 1 |
| inherited HPACK/security obligation | 1 |
| inherited obligation from §13.1.5 evaluation algorithm | 1 |
| inherited obligation from malformed-message definition | 5 |
| normative definition | 3 |
| normative error definition | 1 |
| normative frame grammar | 1 |
| normative grammar plus explicit coding requirements | 1 |
| normative grammar plus RFC 9110 §2.2 | 1 |
| normative grammar plus RFC 9110 §2.2 sender obligation | 1 |
| normative ordered framing algorithm | 6 |
| normative request-control definition | 1 |
| normative response definition | 1 |

## Counts by Achieve applicability

| Applicability | Records |
|---|---:|
| Applicable | 18 |
| Applicable to built-in CONNECT handling | 1 |
| Applicable to byte ranges | 6 |
| Applicable to chunked HTTP/1.1 requests | 1 |
| Applicable to chunked HTTP/1.1 responses | 1 |
| Applicable to chunked requests | 1 |
| Applicable to content negotiation | 1 |
| Applicable to core and application responses | 1 |
| Applicable to filesystem representations | 1 |
| Applicable to HTTP/1.1 | 18 |
| Applicable to HTTP/2 | 25 |
| Applicable to HTTPS | 2 |
| Applicable to negotiated content codings | 1 |
| Applicable to OPTIONS handling | 1 |
| Applicable to range-capable representations | 1 |
| Applicable to range-capable resources | 2 |
| Applicable to received fields | 1 |
| Applicable to secure HTTP/2 | 4 |
| Applicable to supported Achieve endpoints or configurations | 81 |
| Applicable to supported transports | 1 |
| Applicable when Achieve emits a strong validator | 1 |
| Applicable when ETag is generated | 1 |
| Applicable when trailers are received | 1 |
| Conditional configuration | 1 |
| Conditional on generating 401 | 1 |
| Conditional on generating 409 | 1 |
| Conditional on HTTP/1.0 input | 1 |
| Conditional on HTTP/2 CONNECT | 2 |
| Conditional on successful CONNECT | 1 |
| Conditional on successful CONNECT support | 1 |
| Conditional: applies to application-authored responses or optional handlers | 9 |
| Not applicable to Achieve origin-server role | 2 |
| Not applicable to Achieve origin-server role; retained as a scope record | 12 |
| Not applicable to Achieve origin-server role; retained as scope record | 5 |
| Optional HTTP/2 capability | 1 |
| Optional range capability | 1 |

## Reconciliation with the original ledger

| Audited disposition | Original entries | V2 treatment |
|---|---:|---|
| Retain substantially | 31 | Retained with editorial normalization and traceability. |
| Revise | 44 | Reconstructed with corrected citation, level, scope, wording, or responsibility. |
| Split | 30 | Decomposed into independently assessable rows carrying the original ID. |
| Remove or replace | 11 | Removed; replacement obligations, where applicable, are traced to audit additions. |

- All 116 original entries have a documented disposition in `requirements-audit.md`.
- 105 original IDs are directly traceable from one or more V2 rows.
- The 11 unsupported/inapplicable synthetic rows removed rather than carried forward are: `S002,S006,S010,S013,S018,S025,S029,S035,C004,C005,C007`.
- Compound original rows are represented by independently assessable V2 rows with the original ID retained in `source_traceability`.

## Reconciliation with audit additions

- All 76 audit additions are addressed: 76 appear directly in V2 traceability and the mixed-level additions NEW-039, NEW-047, NEW-048, NEW-061, and NEW-076 are split into V2-X records that cite those identifiers.
- Audit wording was corrected where it still combined requirement levels or stated a protocol consequence rather than the underlying obligation.

## Corrected audit recommendations

- `NEW-039` was split into the optional reject/process choice and the mandatory connection close.
- `NEW-047` was split into close, response-field recommendation, and no-further-processing obligations.
- `NEW-048` was split into TLS close-notify and incomplete-message handling.
- `NEW-061` was split into GOAWAY receiver behavior and client retry permission.
- `NEW-076` was split into the cipher prohibition and INADEQUATE_SECURITY consequence.
- Grammar and definition-based rows have blank BCP 14 levels rather than invented MUST/SHOULD values.

## Duplicate and overlap validation

Exact RFC/section/requirement duplicates were merged while preserving all source identifiers. Related requirements that differ by role, condition, normative level, or observable behavior remain separate. No duplicate stable IDs remain.

## Remaining gaps and interpretive limits

- The ledger inventories the four HTTP RFCs but does not independently audit every obligation in RFC 7541 (HPACK), RFC 7301 (ALPN), RFC 8446/RFC 5246 (TLS), RFC 3986 (URI syntax), or RFC 2046 (multipart syntax).
- Some HTTP/2 state-machine duties are recorded by normative table/definition rather than reproducing every cell as a separate row; a frame-level verification plan may split them further.
- Optional application-registered methods and direct servlet response ownership remain conditional application responsibilities.
- TLS applicability depends on the supported caller-supplied configuration envelope.
- Scope records for client, proxy, and cache roles are retained only where they prevent role confusion; they are marked not applicable to Achieve as an origin server.

## External normative dependencies not independently audited

RFC 3986 URI syntax, RFC 7541 HPACK, RFC 7301 ALPN, RFC 8446/RFC 5246 TLS, and RFC 2046 multipart syntax are recorded as dependencies in notes and responsibility fields. Full independent audits remain outstanding.

## Readiness for conformance assessment

The V2 ledger is suitable as the baseline for a new, independent conformance assessment of RFC 9110–9113 obligations, provided that the stated external-dependency and HTTP/2 state-table limits remain explicit. It must not be combined mechanically with the original status totals.

## Validation performed

- CSV parsing succeeded.
- Stable IDs are unique.
- Every row contains RFC, section, official URL, normative basis, role, responsibility, applicability, traceability, and `Not yet reassessed` status.
- All cited URLs use the official RFC Editor section form.
- Original and audit source reconciliation was checked programmatically.

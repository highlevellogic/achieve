# Achieve 3.0.6 HTTP Conformance Quality Corrections Applied

## Scope

This report records the approved corrections from
`quality-review-followup.md`. The corrections affect only the V3 assessment,
its V2-to-V3 traceability map, and supporting assessment summaries. No new
protocol probe was run, and no Achieve implementation, test, V2 assessment, or
public specification page was changed.

## Inventory and classification changes

| Classification | Before | After | Change |
|---|---:|---:|---:|
| Conformant | 152 | 151 | -1 |
| Nonconformant | 14 | 15 | +1 |
| Unverified | 11 | 14 | +3 |
| Not applicable | 22 | 22 | 0 |
| Optional not implemented | 9 | 9 | 0 |
| **Total** | **208** | **211** | **+3** |

The final RFC subtotals are:

| RFC | Conformant | Nonconformant | Unverified | Not applicable | Optional not implemented | Total |
|---|---:|---:|---:|---:|---:|---:|
| RFC 9110 | 81 | 3 | 5 | 8 | 3 | 100 |
| RFC 9111 | 0 | 0 | 0 | 3 | 4 | 7 |
| RFC 9112 | 31 | 2 | 0 | 8 | 1 | 42 |
| RFC 9113 | 39 | 10 | 9 | 3 | 1 | 62 |
| **Overall** | **151** | **15** | **14** | **22** | **9** | **211** |

## Applied corrections

### New and split records

- Added `V3-9113-061` for RFC 9113 section 9.2.2's MUST that an HTTP/2
  deployment over TLS 1.2 support
  `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` with P-256. It is **Unverified**:
  existing evidence establishes cipher negotiation but not the selected or
  supported ephemeral curve. This requirement was absent from V2 and has no
  V2 source ID.
- Retained `V3-9112-041` for the section 9.8 client SHOULD concerning framed
  completion and graceful recovery, and added `V3-9112-042` for the separate
  declarative rule governing completion of an unframed close-delimited
  response. Both are **Not applicable** to Achieve's origin-server role.
  Mapping row `V2-X043` now records a split to both IDs.
- Added `V3-9113-062` for RFC 9113 section 9.2.1's TLS 1.2 renegotiation
  disablement obligation, leaving the distinct post-preface error-handling
  obligation in `V3-9113-053`. The new record is
  **Unverified** because one unsuccessful renegotiation attempt does not
  establish the full obligation. Mapping row `V2-NEW-075` now splits to
  `V3-9113-053` and `V3-9113-062`.

### Classification changes

- Reclassified `V3-9110-098` from **Not applicable** to **Nonconformant**.
  The focused reproduction recorded valid classic HTTP/2 CONNECT receiving a
  Node-generated 405 with no `Allow` field. RFC 9110 section 15.5.6 requires
  an origin server generating 405 to generate `Allow`. Responsibility is
  assigned to Node's HTTP/2 compatibility layer within the complete supported
  Achieve endpoint.
- Corrected `V3-9113-059` to RFC 9113 section 10.5.1's actual MUST: process a
  field block sufficiently to maintain consistent connection state unless the
  connection is closed. Its former finite-size-limit wording was not the
  section's requirement. The classification changed from **Conformant** to
  **Unverified** because existing resource-limit evidence does not establish
  HPACK/connection-state consistency after rejecting an excessive field
  section.

### Requirement-boundary and evidence corrections

- Preserved `V3-9113-007` as **Nonconformant**, but explicitly identified it
  as a composite summary record retained for V2 traceability. Its count can
  overlap narrower requirement-level failures and must not be described as an
  independent root cause.
- Preserved `V3-9113-014` as **Unverified**. Its existing rationale already
  limits the evidence to observed connection-error families and does not
  infer the broad SHOULD universally.
- Removed the optional MAY provision from the mandatory requirement text of
  `V3-9113-031`; the permission to send an HTTP response remains documented
  as a condition. Its **Unverified** classification is unchanged.
- Narrowed `V3-9112-001` and `V3-9112-002` evidence and rationale to the
  representative wire behavior and Node.js 22.15.0 parser/serializer actually
  observed. Both remain **Conformant**.
- Narrowed `V3-9113-003` sender evidence to the frame families actually
  captured while retaining the direct receiver test and centralized
  Node/nghttp2 framing evidence. It remains **Conformant**.
- Removed the client-side outstanding-PING result as affirmative server-side
  evidence for `V3-9113-060`. Documented finite server-side controls remain
  the basis for its **Conformant** SHOULD-level classification.
- Restored the exact-text interpretation for `V3-9110-088`. In the tested
  If-Range 206 responses, both `Content-Type` and `Last-Modified` are beyond
  the preceding section 15.3.7 required field set; section 15.3.7.1 does not
  expressly require `Content-Type` for a single-part 206. The existing
  **Nonconformant** SHOULD-level classification is unchanged.

## Traceability changes

All 209 V2 mapping rows remain present and unique. The mapping action totals
are 179 Retained, 19 Corrected, 5 Split, 4 Merged, and 2 Removed. Every
nonempty mapping target resolves to a V3 ID. `V3-9113-061` is the sole V3
record without a V2 source or mapping target, intentionally documenting a
newly discovered obligation rather than inventing historical traceability.

No existing V3 ID was deleted, renumbered, or reassigned. The inventory grew
by the three approved records: `V3-9112-042`, `V3-9113-061`, and
`V3-9113-062`.

## Validation

- The V3 CSV parses as 211 rows with 211 unique IDs and the expected 15
  columns.
- Every row has a recognized classification and supporting rationale.
- Per-RFC subtotals and overall totals were recalculated from the CSV and
  match the tables above.
- The V2-to-V3 mapping parses as 209 unique V2 IDs; every nonempty target is
  present in the V3 ledger.
- The three added IDs are documented explicitly, including the intentional
  absence of a V2 predecessor for `V3-9113-061`.
- No protocol tests or probes were run for these documentation-only
  corrections.

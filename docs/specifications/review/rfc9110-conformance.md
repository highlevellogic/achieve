# RFC 9110 Conformance Assessment for Achieve 3.0.6

## Executive summary

All **100** RFC 9110 rows in `requirements-ledger-v2.csv` were assessed exactly once. No confirmed nonconformity was demonstrated. The assessment is deliberately conservative: broad parser duties, delegated Node behavior without focused proof, trailers, and application-authored status responses remain Unverified.

## Classification totals

| Classification | Count |
|---|---:|
| Conformant | 68 |
| Not applicable | 5 |
| Optional not implemented | 3 |
| Unverified | 24 |

## Coverage confirmation

The CSV preserves every RFC 9110 V2 requirement ID and citation. Each appears once and contains implementation evidence, test evidence, rationale, and any unresolved question. RFC 9111–9113 rows were not assessed.

## Confirmed nonconformities

None. No reproducible MUST- or MUST NOT-level violation was established by the available implementation evidence or the focused test runs. This is not a claim of complete conformance: Unverified rows remain open.

## Unverified requirements grouped by reason

| Reason | Representative requirements |
|---|---|
| Broad or delegated parsing behavior lacks an exhaustive corpus or authoritative runtime proof | RFC 9110 §§2.2–2.4, 5.3–5.5 |
| Application-authored response behavior is outside Achieve core generation but remains possible through the exposed response object | trailers, 205, 401, 409 |
| Node-owned behavior lacks a focused verifier | Expect/100-continue, some Date/status handling, 408 |
| Full metadata/header equivalence was not established for every 206 or 304 variant | §§15.3.7 and 15.4.5 |

The authoritative row-level list is the CSV; there are **24** Unverified rows.

## Not-applicable and optional-feature decisions

- Client-only retry and TRACE-content duties and proxy-only `Vary: *` generation are outside the Achieve origin-server role.
- Successful CONNECT tunneling is not implemented; successful-CONNECT framing duties are therefore recorded as Optional not implemented.
- Achieve does not generate multipart/byteranges; the conditional multipart obligation is Not applicable and the optional one-part multipart form is Optional not implemented.
- Achieve does not generate 405 in its core method dispatcher, so the conditional Allow-on-405 obligation is Not applicable to current core behavior.

## Ledger requirements needing correction or subdivision

| ID | Issue |
|---|---|
| V2-NEW-006 | Ledger role is incorrectly labeled client; RFC 9110 section 3.3 places this restriction on a server. |
| V2-NEW-007 | Ledger role/applicability are incorrect: the requirement applies to non-proxy recipients, including an origin server, rather than only proxies. |
| V2-NEW-018 | Ledger role is incorrectly labeled client; the subject of the requirement is a server generating trailers. |
| V2-NEW-028 | Ledger role/applicability are incorrect: this is a server/sender obligation for a 304 response, not a cache-only obligation. |
| V2-NEW-029 | Ledger role/applicability are incorrect: this is a 304 sender recommendation, not a cache-only obligation. |

The defects above were not silently repaired in the CSV; IDs and requirement text remain tied to the V2 ledger. The 304 rows should be corrected before a later combined score is treated as authoritative.

## Recommended next verification steps

1. Add a focused Node 22 field-parser matrix for duplicate fields, whitespace, CR/LF/NUL, size rejection, and incomplete headers across HTTP/1.1 and HTTP/2.
2. Add Expect/100-continue tests that prove timing and final-response alternatives.
3. Exercise all conditional 206/304 metadata fields against corresponding 200 responses.
4. Decide and document the responsibility boundary for application-authored trailers and 205/401/409 responses.
5. Obtain authoritative Node evidence or probes for Date generation on all status classes and 408 connection closure.

## Tests executed

- `tests/conditional/verify.js`: PASS
- `tests/static_dates/verify.js`: PASS
- `tests/byte_ranges/verify.js`: PASS
- `tests/response_completion/verify.js`: PASS
- `tests/connect/verify.js`: PASS
- `tests/request_target_syntax/verify.js`: PASS (560 checks)

No implementation or test files were changed.

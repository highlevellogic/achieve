# RFC 9111 Conformance Assessment for Achieve 3.0.6

## Executive summary

All **eight** RFC 9111 rows in `requirements-ledger-v2.csv` were assessed exactly once. Achieve is an origin server, not an HTTP cache: the storage, reuse, and Pragma compatibility records are outside its supported role. Achieve core does not generate Cache-Control or Expires, so the four optional directive forms are not implemented. No violation was demonstrated.

## Classification totals

| Classification | Count |
|---|---:|
| Not applicable | 4 |
| Optional not implemented | 4 |

## Applicable origin-server obligations

The ledger contains four conditional sender/origin-server records: max-age, s-maxage, qualified no-cache, and qualified private syntax, plus the clockless-server Expires restriction. Achieve core emits none of those fields. `setCaching()` enables validators and conditional-request metadata; it is not an HTTP cache and does not generate Cache-Control. Optional directives are therefore classified Optional not implemented. The clockless Expires condition is Not applicable because supported Node operation has a clock and core emits no Expires field.

Servlets receive the Node response object and can author Cache-Control or Expires themselves. Such application-authored syntax is the application responsibility; a hypothetical invalid servlet field is not attributed to Achieve core.

## Cache-only requirements

- `V2-X029` (section 3 storage gate): Not applicable; Achieve stores no HTTP responses for later request reuse.
- `V2-X030` (section 4 reuse gate): Not applicable; Achieve does not construct responses from an HTTP cache.
- `V2-C006` (Pragma): Not applicable to the origin-server role and independently unsupported by the cited RFC text.

## Confirmed violations

None. No applicable Achieve-generated directive violates RFC 9111, and cache-only behavior is outside the Achieve role.

## Unverified obligations and recommended verification

There are no Unverified rows in this eight-row inventory. If Achieve later generates Cache-Control or Expires, add exact serialization tests for token versus quoted-string directive arguments and clock conditions before reclassifying those rows.

## Ledger corrections and omissions

| ID | Discrepancy |
|---|---|
| V2-NEW-031 | Applicable role should be sender, not sender/recipient. |
| V2-NEW-032 | Applicable role should be sender, not sender/recipient. |
| V2-NEW-033 | Applicable role is incorrectly cache and applicability incorrectly says cache-only; RFC 9111 section 5.2.2.4 places the recommendation on any sender generating qualified no-cache. |
| V2-NEW-034 | Applicable role should be sender, not sender/recipient. |
| V2-C006 | Unsupported requirement: RFC 9111 section 5.4 deprecates Pragma and states that response Pragma has unspecified/unreliable semantics, but does not grant the recorded MAY to equate request Pragma with Cache-Control. |

The ledger also does not inventory every possible origin-server recommendation in RFC 9111 (for example, the section 7.3 encouragement to emit appropriate Cache-Control for sensitive responses is not a BCP 14 obligation). No missing mandatory Achieve-origin obligation was identified within the assessed feature set.

## Evidence and tests

- The official RFC 9111 sections were checked directly. Section 3 and section 4 duties expressly address caches.
- Sections 5.2.2.1 and 5.2.2.10 prohibit quoted max-age/s-maxage values; sections 5.2.2.4 and 5.2.2.7 recommend quoted field-name lists.
- The section 5.3 prohibition is conditional on an origin server without a clock.
- Section 5.4 contains no normative MAY matching `V2-C006`.

No tests were executed for this assessment. Existing validator/date tests were inspected; no applicable HTTP-cache implementation exists to exercise.

No implementation, test, ledger, or earlier assessment file was modified.

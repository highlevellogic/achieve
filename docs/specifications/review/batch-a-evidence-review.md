# Batch A HTTP/2 evidence review

## Scope

This review independently reassesses the 17 Batch A records from the V3
inventory against RFC 9113 and the existing P-series raw-frame evidence. No
new probes were run. Results describe the Achieve 3.0.6 endpoint on the tested
Node.js 22.15.0 runtime unless stated otherwise.

The review resolves 14 records as **Conformant**, retains two corrected records
as **Unverified**, and corrects one record to **Not applicable**. The V3
inventory remains 208 records and all original V3 identifiers and V2 source
mappings remain traceable.

## Decisions

| ID | RFC obligation reviewed | Existing evidence | Decision |
|---|---|---|---|
| V3-9113-002 | Section 4.2 requires `FRAME_SIZE_ERROR` when a frame exceeds `SETTINGS_MAX_FRAME_SIZE` or a frame-specific size limit. | P08 sent DATA length 16,385 against the advertised/default 16,384 maximum and observed GOAWAY `FRAME_SIZE_ERROR`. | **Conformant.** The probe directly exercises the recipient condition, code, and connection scope. The ledger citation was corrected from §4.1 to §4.2. |
| V3-9113-004 | Section 4.1 requires implementations to ignore and discard unknown frame types. | P02 sent type `0xfe`, then a valid request; the request succeeded on the same connection. | **Conformant.** Discard and continued usability are directly observed. |
| V3-9113-005 | Section 4.3 requires a sender to transmit a fragmented field block as a contiguous HEADERS or PUSH_PROMISE plus CONTINUATION sequence without interleaving another frame type or stream. | P04 successfully exercises receiver reassembly. P05-P07 exercise receiver error handling for interleaving, wrong-stream CONTINUATION, and orphan CONTINUATION. No probe captures a multi-frame field block sent by the server. | **Unverified.** Receiver behavior does not establish the corrected sender obligation. The former row incorrectly assigned the transmission MUST to a decoder. |
| V3-9113-006 | Section 4.3 requires failure to decompress, including a decoding error, to terminate the connection with `COMPRESSION_ERROR`. | P25-P28 and P30 exercised five structurally distinct HPACK failures; every case received GOAWAY `COMPRESSION_ERROR`. | **Conformant.** Exhaustive enumeration of invalid octet strings is not necessary. The previously blank normative level was corrected to MUST. |
| V3-9113-017 | Section 6.5 requires an ACK SETTINGS payload to be empty; nonzero length is connection `FRAME_SIZE_ERROR`. | P09 sent ACK SETTINGS with six payload bytes and observed GOAWAY `FRAME_SIZE_ERROR`. | **Conformant.** Exact condition, error code, and scope are observed. |
| V3-9113-021 | Section 6.7 requires a non-ACK PING to receive an ACK PING with identical opaque data. | P03 sent `3132333435363738`, observed the identical ACK payload, and then completed a valid request. | **Conformant.** Acknowledgment, identity, ignored unknown flag, and connection continuity are observed. |
| V3-9113-033 | Sections 8.2.1 and 8.1.1 prohibit uppercase field-name octets and require a violating request to be treated as malformed. | P31 sent `X-Test: x`; it received stream `PROTOCOL_ERROR`, and a later stream succeeded. | **Conformant.** The receiver-side field-validation and malformed-message obligation is directly exercised. |
| V3-9113-034 | Section 8.2.2 says an endpoint **MUST NOT generate** an HTTP/2 message containing connection-specific fields. | P32-P36 are receiver tests; they do not inspect server-generated response fields or attempts by applications to set prohibited fields. | **Unverified.** The former row duplicated the receiver statement and incorrectly scoped it to a proxy. It is corrected to the distinct endpoint sender obligation. |
| V3-9113-035 | Section 8.2.2 requires a message containing connection-specific fields to be treated as malformed under §8.1.1. | P32-P36 separately sent Connection, Keep-Alive, Proxy-Connection, Transfer-Encoding, and Upgrade. Each received stream `PROTOCOL_ERROR`; each connection remained usable. | **Conformant.** Every field named by the RFC is covered with correct error scope and continuity. |
| V3-9113-037 | Section 8.2.2 permits TE in a request only when it contains `trailers`; any other value is prohibited and malformed. | P37 rejected `TE: gzip` with stream `PROTOCOL_ERROR`; P38 accepted `TE: trailers`. | **Conformant.** Both normative branches are observed. The ledger citation was corrected from §8.2.3 to §8.2.2 and the level to MUST NOT. |
| V3-9113-038 | Section 8.3 requires all pseudo-headers to precede regular fields and requires a violation to be malformed. | P39 placed `:path` after a regular field, received stream `PROTOCOL_ERROR`, and retained connection usability. | **Conformant.** Exact ordering failure and required handling are observed. |
| V3-9113-040 | Section 8.3 prohibits the same pseudo-header name more than once and requires duplicates to be malformed. | P40, P43, and P45 duplicated `:method`, `:scheme`, and `:path`; all produced stream `PROTOCOL_ERROR` with usable connections. | **Conformant.** Multiple names establish generic duplicate enforcement; duplicating `:authority` separately is not needed to infer an untested special case. |
| V3-9113-041 | Section 8.3.1 requires nonempty `:path` for HTTP(S); asterisk-form OPTIONS uses `*`, while classic CONNECT omits `:path`. | P46 sent empty `:path` on GET and received stream `PROTOCOL_ERROR`; the connection remained usable. Existing CONNECT coverage provides the relevant omission control. | **Conformant.** The prohibited empty value is directly exercised. The ledger wording was corrected because `OPTIONS *` is not an empty-path exception. |
| V3-9113-042 | Section 8.3.1 requires exactly one valid `:method` on every HTTP/2 request. | P40 and P41 exercised duplicate and missing `:method`; both received stream `PROTOCOL_ERROR`. | **Conformant.** Both uniqueness and presence are directly observed. |
| V3-9113-043 | Section 8.3.1 requires exactly one valid `:scheme` for non-CONNECT requests. | P42 and P43 exercised missing and duplicate `:scheme`; both received stream `PROTOCOL_ERROR`. | **Conformant.** Both applicable failure conditions are directly observed; classic CONNECT is excluded. |
| V3-9113-044 | Section 8.3.1 requires exactly one valid, nonempty `:path` for non-CONNECT requests, subject to the asterisk-form OPTIONS rule. | P44-P46 exercised missing, duplicate, and empty `:path`; every case received stream `PROTOCOL_ERROR`. | **Conformant.** Presence, uniqueness, and nonempty value are directly observed. |
| V3-9113-058 | Section 10.3 requires an intermediary translating HTTP/2 to another HTTP version to validate fields under §8.2 before translation. It does not state the former HPACK-context obligation. | P25-P30 concern HPACK decoding errors and context isolation, not intermediary translation. Achieve operates as an origin server and does not translate or forward messages to another HTTP version. | **Not applicable.** The ledger row is corrected to the actual conditional intermediary obligation. HPACK decode failures remain represented by V3-9113-006. |

## Inventory corrections and traceability

- `V3-9113-002` now cites §4.2, where the oversized-frame error requirement
  appears. Its identifier and `V2-H202` source remain unchanged.
- `V3-9113-005` now records §4.3's sender duty to transmit fragmented field
  blocks contiguously. `V2-X044` maps to the same identifier with status
  **Corrected**; the receiver probes remain supporting evidence for other
  sequencing requirements but do not resolve this sender record.
- `V3-9113-006` now records the explicit MUST stated in §4.3. Its identifier
  and `V2-X045` source remain unchanged.
- `V3-9113-034` now records the endpoint sender prohibition from §8.2.2.
  `V2-NEW-063` maps to the same V3 identifier with status **Corrected**.
- `V3-9113-037` now cites §8.2.2 and records MUST NOT. Its identifier and
  `V2-NEW-068` source remain unchanged.
- `V3-9113-041` now distinguishes a prohibited empty value, the required `*`
  value for asterisk-form OPTIONS, and omission for classic CONNECT.
- `V3-9113-058` now records the actual §10.3 intermediary obligation.
  `V2-X064` maps to the same V3 identifier with status **Corrected**.

No row was deleted, renumbered, or silently replaced. The P-series HPACK
context observations remain valid evidence, but they do not create a separate
normative requirement at RFC 9113 §10.3.

## Count reconciliation

| RFC | Conformant | Nonconformant | Unverified | Not applicable | Optional not implemented | Total |
|---|---:|---:|---:|---:|---:|---:|
| RFC 9110 | 68 | 0 | 24 | 5 | 3 | 100 |
| RFC 9111 | 0 | 0 | 0 | 3 | 4 | 7 |
| RFC 9112 | 25 | 1 | 7 | 7 | 1 | 41 |
| RFC 9113 | 28 | 5 | 24 | 3 | 0 | 60 |
| **Overall** | **121** | **6** | **55** | **18** | **8** | **208** |

Before Batch A, the overall totals were 107 Conformant, 6 Nonconformant, 70
Unverified, 17 Not applicable, and 8 Optional not implemented. The net change
is +14 Conformant, -15 Unverified, and +1 Not applicable. The six known
Nonconformant findings are unchanged.

## Remaining Batch A uncertainty

Corrected `V3-9113-005` and `V3-9113-034` remain Unverified. The former needs
capture of a server-generated multi-frame field block to establish contiguous
sender output. The latter needs response capture across representative Achieve
paths and attempts to set each prohibited connection-specific field through
the supported application response interface. Both belong to the later
sender/output batch and were not performed here.

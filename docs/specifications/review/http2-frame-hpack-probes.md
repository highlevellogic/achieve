# Achieve 3.0.6 HTTP/2 Frame and HPACK Probes

## Purpose and scope

This campaign tested malformed-frame, field-block, and HPACK behavior at Achieve's supported cleartext HTTP/2 origin-server endpoint. It used the V3 inventory as the baseline and did not change Achieve or its tests. The normative sources were [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html) and [RFC 7541](https://www.rfc-editor.org/rfc/rfc7541.html).

The targeted V3 records were:

`V3-9113-002` through `V3-9113-009` (excluding no records in that interval), `V3-9113-014`, `V3-9113-015`, `V3-9113-017`, `V3-9113-019`, `V3-9113-020`, `V3-9113-021`, `V3-9113-026`, `V3-9113-031`, `V3-9113-033` through `V3-9113-035`, `V3-9113-037` through `V3-9113-044`, and `V3-9113-058`.

This is 28 requirements. Broad stream-state, generic error-handling, malformed-message, and compression-context records remain Unverified where representative probes do not cover their complete normative scope.

## Environment

- Achieve 3.0.6, loaded directly from `C:\projects\achieve-3.0.5-dev\achieve.js`.
- Node.js 22.15.0 on Windows; `process.versions.nghttp2` was 1.64.0 and `process.versions.openssl` was 3.0.16.
- The probe endpoint was a temporary local h2c server created by `achieve.listen2(24888)`. Achieve delegates the frame layer and HPACK to Node.js/nghttp2 (`achieve.js:1463-1512`) and receives compatibility-API requests only after protocol decoding (`achieve.js:1407-1441`).
- h2c was selected because the targeted requirements apply after HTTP/2 establishment and do not depend on TLS. No h2-only claim is made from these results.
- Each probe used a fresh TCP connection, a valid 24-byte client preface, and an empty client SETTINGS frame before the test sequence. Each was bounded to 450 ms (500 ms for the deliberate truncation case).

## Wire format and reproducibility

The sender constructed the 9-byte frame header directly: 24-bit payload length, 8-bit type, 8-bit flags, and a 32-bit stream field. Unless a probe says otherwise, requests used `HEADERS flags=0x05` (`END_STREAM|END_HEADERS`) and stream 1. The valid HPACK request block was:

```text
82                         indexed :method GET
86                         indexed :scheme http
84                         indexed :path /
01 0f 31 32 37 2e 30 2e 30 2e 31 3a 32 34 38 38 38
                           literal :authority 127.0.0.1:24888
```

For stream-error probes, a valid request on stream 3 followed after 100 ms. A response `HEADERS` on stream 3 established that the connection remained usable. A connection outcome was accepted only when an actual `GOAWAY` frame and its 32-bit error code were decoded; a stream outcome required an actual `RST_STREAM`. Socket closure alone was not treated as proof.

Error codes below use RFC 9113 names: `PROTOCOL_ERROR=0x1`, `INTERNAL_ERROR=0x2`, `FLOW_CONTROL_ERROR=0x3`, `FRAME_SIZE_ERROR=0x6`, and `COMPRESSION_ERROR=0x9`.

## Probe results

### Framing, flags, stream identifiers, and sequencing

| Probe | V3 ID | Exact test sequence | Required result | Observed result | Scope / usability | Evidence-supported conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | 003 | Valid HEADERS with raw stream field `0x80000001` | Ignore reserved bit | Normal response on stream 1 | Connection usable | Receiving half established; sender half untested, so record remains Unverified. |
| P02 | 004 | Unknown type `0xfe`, length 0, stream 0; then valid HEADERS | Discard unknown frame | Normal response on stream 1 | Connection usable | Conformant. |
| P03 | 003, 021 | PING flags `0x80`, stream 0, payload `31 32 33 34 35 36 37 38`; then valid HEADERS | Ignore unknown flag and ACK identical payload | PING ACK plus normal response | Connection usable | PING behavior Conformant; V3-9113-003 still lacks sender evidence. |
| P04 | 005 | HEADERS without END_HEADERS containing first 3 HPACK octets; matching CONTINUATION with remainder and END_HEADERS | Reassemble as one block | Normal response | Connection usable | Conformant. |
| P05 | 005, 007, 014 | P04 HEADERS fragment; intervening PING; matching CONTINUATION | Connection `PROTOCOL_ERROR` | GOAWAY `PROTOCOL_ERROR` | Connection terminated after GOAWAY | Required case established. |
| P06 | 005, 007, 014 | HEADERS fragment on stream 1; CONTINUATION on stream 3 | Connection `PROTOCOL_ERROR` | GOAWAY `PROTOCOL_ERROR` | Connection terminated after GOAWAY | Required case established. |
| P07 | 005, 007, 014 | Orphan CONTINUATION on stream 1 | Connection `PROTOCOL_ERROR` | GOAWAY `PROTOCOL_ERROR` | Connection terminated after GOAWAY | Required case established. |
| P08 | 002, 014 | DATA length 16,385 (default advertised maximum 16,384) | `FRAME_SIZE_ERROR` | GOAWAY `FRAME_SIZE_ERROR` | Connection terminated after GOAWAY | V3-9113-002 Conformant. |
| P09 | 017, 014 | SETTINGS ACK with 6-byte payload | Connection `FRAME_SIZE_ERROR` | GOAWAY `FRAME_SIZE_ERROR` | Connection terminated after GOAWAY | V3-9113-017 Conformant. |
| P10 | 007, 014 | SETTINGS length 5 | Connection `FRAME_SIZE_ERROR` | GOAWAY `FRAME_SIZE_ERROR` | Connection terminated after GOAWAY | Required case established. |
| P11 | 019, 007 | SETTINGS_ENABLE_PUSH=`2` (`00 02 00 00 00 02`) | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | Nonconformant error code. |
| P12 | 019, 007 | SETTINGS_INITIAL_WINDOW_SIZE=`0x80000000` | Connection `FLOW_CONTROL_ERROR` | GOAWAY `FLOW_CONTROL_ERROR` | Connection terminated | Required case established. |
| P13 | 019, 007 | SETTINGS_MAX_FRAME_SIZE=`16383` | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | Nonconformant error code. |
| P14 | 007 | SETTINGS length 0 on stream 1 | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | Nonconformant error code. |
| P15 | 007 | HEADERS on stream 0 | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | Nonconformant error code. |
| P16 | 008, 007 | Client opens even-numbered stream 2 with valid HEADERS | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | V3-9113-008 Nonconformant. |
| P17 | 009, 007 | Valid stream 3, then lower new stream 1 | Connection `PROTOCOL_ERROR` | GOAWAY `PROTOCOL_ERROR` | First request processed; connection then terminated | Ordering subcase passes; reuse and all state cases remain unverified. |
| P18 | 007 | DATA length 1 on stream 0 | Connection `PROTOCOL_ERROR` | GOAWAY `PROTOCOL_ERROR` | Connection terminated | Required case established. |
| P19 | 007 | PING length 8 on stream 1 | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | Nonconformant error code. |
| P20 | 007 | PING length 7 on stream 0 | Connection `FRAME_SIZE_ERROR` | GOAWAY `FRAME_SIZE_ERROR` | Connection terminated | Required case established. |
| P21 | 007 | RST_STREAM length 3 on stream 1 | Connection `FRAME_SIZE_ERROR` | GOAWAY `FRAME_SIZE_ERROR` | Connection terminated | Required case established. |
| P22 | 020, 007 | Client sends PUSH_PROMISE on stream 1, promised stream 2, valid request block | Server must issue connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | V3-9113-020 Nonconformant. |
| P23 | 026, 007 | WINDOW_UPDATE increment 0 on stream 0 | Connection `PROTOCOL_ERROR` | GOAWAY `INTERNAL_ERROR` | Connection terminated | Nonconformant code. |
| P24 | 026, 007, 015 | Valid request stream 1, then WINDOW_UPDATE increment 0 on stream 1; valid stream 3 queued | Stream `PROTOCOL_ERROR` via RST_STREAM | GOAWAY `INTERNAL_ERROR`; no stream 3 response | Connection terminated, not usable | Nonconformant code and scope. |
| P48 | 007 | PING header declares length 8; only 7 payload bytes sent, then TCP half-close | No complete frame exists; transport termination is not by itself a protocol-error proof | Server SETTINGS and SETTINGS ACK only; no GOAWAY/RST_STREAM before close | Connection closed after EOF | Inconclusive by design; no classification change. |

### HPACK decoding and compression context

| Probe | V3 ID | Exact field-block bytes or sequence | Required result | Observed result | Scope | Evidence-supported conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| P25 | 006 | `80` (indexed representation with prohibited index 0) | Connection `COMPRESSION_ERROR` | GOAWAY `COMPRESSION_ERROR` | Connection | Pass. |
| P26 | 006 | `ff` (unterminated indexed integer) | Connection `COMPRESSION_ERROR` | GOAWAY `COMPRESSION_ERROR` | Connection | Pass. |
| P27 | 006 | `3f e2 1f` (dynamic table size 4097, above 4096) | Connection `COMPRESSION_ERROR` | GOAWAY `COMPRESSION_ERROR` | Connection | Pass. |
| P28 | 006 | Valid request fields followed by `20` (table-size update after a field representation) | Connection `COMPRESSION_ERROR` | GOAWAY `COMPRESSION_ERROR` | Connection | Pass. |
| P29 | 058 | Stream 1 inserts `x-dyn: one` with incremental indexing; stream 3 references dynamic index 62 (`be`) | Same-connection decoder context permits reference | Both streams receive normal responses | Connection usable | Connection-scoped context retention established. |
| P30 | 006, 058 | Fresh connection references dynamic index 62 (`be`) without insertion | Connection `COMPRESSION_ERROR` | GOAWAY `COMPRESSION_ERROR` | Connection | Isolation between connections established. V3-9113-058 remains problematic as a ledger record because RFC 9113 §10.3 does not state its summarized obligation. |

Four distinct HPACK decoding failures produced the required connection error. This supports Conformant for V3-9113-006, while it is not a proof of every invalid octet sequence.

### Malformed fields and pseudo-headers

All malformed-request probes below received `RST_STREAM(PROTOCOL_ERROR)` on stream 1. In each case the subsequent valid request on stream 3 received a normal response, proving the error was stream-scoped and the connection remained usable. P38 was the positive control and received a normal response directly.

| Probe | V3 ID | Exact added field/control data | Expected | Observed | Supported conclusion |
| --- | --- | --- | --- | --- | --- |
| P31 | 031, 033 | Literal `X-Test: x` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | V3-9113-033 Conformant. |
| P32 | 031, 034, 035 | `connection: close` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Pass. |
| P33 | 031, 034, 035 | `keep-alive: timeout=5` | Same | Same | Pass. |
| P34 | 031, 034, 035 | `proxy-connection: close` | Same | Same | Pass. |
| P35 | 031, 034, 035 | `transfer-encoding: chunked` | Same | Same | Pass. |
| P36 | 031, 034, 035 | `upgrade: websocket` | Same | Same | V3-9113-035 Conformant across all five named fields. |
| P37 | 031, 037 | `te: gzip` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Pass. |
| P38 | 037 | `te: trailers` | Valid | Normal response | V3-9113-037 Conformant with positive and negative controls. |
| P39 | 031, 038 | Indexed `:path /` after literal `x: y` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | V3-9113-038 Conformant. |
| P40 | 031, 040, 042 | Two indexed `:method GET` fields | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Duplicate-method case passes. |
| P41 | 031, 042 | No `:method` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | V3-9113-042 Conformant with absence and duplication covered. |
| P42 | 031, 043 | No `:scheme` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Pass. |
| P43 | 031, 040, 043 | Two indexed `:scheme http` fields | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | V3-9113-043 Conformant. |
| P44 | 031, 044 | No `:path` | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Pass. |
| P45 | 031, 040, 044 | Two indexed `:path /` fields | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Duplicate-path case passes. |
| P46 | 031, 041, 044 | Literal `:path` with empty value | Malformed for GET; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | V3-9113-041 and V3-9113-044 Conformant for the applicable non-CONNECT request. |
| P47 | 031, 039 | Indexed `:status 200` in a request | Malformed; stream `PROTOCOL_ERROR` | RST_STREAM; stream 3 succeeded | Request-context subcase passes; invalid response and trailer contexts are outside this server-input probe, so V3-9113-039 remains Unverified. |

V3-9113-031 remains Unverified because it intentionally summarizes all malformed HTTP/2 requests. The campaign establishes multiple field and pseudo-header categories, but not content-length mismatch, every prohibited field character/value, extraneous DATA/trailers, or every other malformed-message condition.

## Confirmed nonconforming outcomes

The wire observations demonstrate five V3 records with at least one applicable violation:

1. **V3-9113-007:** multiple frame/state violations that require `PROTOCOL_ERROR` instead produced `INTERNAL_ERROR`.
2. **V3-9113-008:** an even client-initiated stream ID produced `INTERNAL_ERROR`, not `PROTOCOL_ERROR`.
3. **V3-9113-019:** out-of-range ENABLE_PUSH and MAX_FRAME_SIZE settings produced `INTERNAL_ERROR`, not the required `PROTOCOL_ERROR`; INITIAL_WINDOW_SIZE correctly produced `FLOW_CONTROL_ERROR`.
4. **V3-9113-020:** a client PUSH_PROMISE produced `INTERNAL_ERROR`, not `PROTOCOL_ERROR`.
5. **V3-9113-026:** zero WINDOW_UPDATE produced `INTERNAL_ERROR`; the stream-scoped case also incorrectly terminated the connection instead of resetting only the stream.

These are endpoint results owned by the Node.js/nghttp2 protocol layer used by Achieve. Delegation identifies the responsible component but does not remove Achieve's conformance exposure.

## Reproduction and limitations

To reproduce, start an Achieve h2c server with a temporary application directory, connect with `node:net`, send the client preface and empty SETTINGS, then transmit the frame sequences above. Parse every server frame rather than treating socket closure as an error result. Use a fresh connection per malformed connection-level test and a bounded timeout.

Limitations:

- The campaign ran on one supported runtime/platform combination: Node 22.15.0, nghttp2 1.64.0, Windows. It did not compare other Node/nghttp2 builds.
- h2 over TLS was not repeated because none of the selected obligations depends on TLS after protocol establishment. That equivalence is reasoned, not independently observed here.
- P48 cannot establish a protocol error because EOF arrived before the declared frame was complete.
- Broad records V3-9113-003, 007, 009, 014, 015, 031, 039, and 058 retain unresolved scope even where individual subcases are established.
- V3-9113-034 is descriptive, has no normative level, and is incorrectly scoped to `proxy` in V3 even though the receiving-origin behavior is normatively captured by V3-9113-035.
- V3-9113-058 cites RFC 9113 §10.3, but that section concerns intermediary encapsulation attacks; its current wording combines HPACK context/error concepts from elsewhere. It should be corrected or split before classification.

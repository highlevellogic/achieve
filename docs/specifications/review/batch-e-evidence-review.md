# Batch E HTTP/2 Stream-State and Flow-Control Evidence Review

## Scope and method

This review covers the 13 Batch E records from the 208-record V3 inventory:
`V3-9113-009`, `011`, `012`, `013`, `014`, `015`, `025`, `027`,
`028`, `029`, `030`, `031`, and `039`.

The normative source was RFC 9113 sections 5.1.1, 5.1.2, 5.2, 5.4,
6.9, 8.1, 8.1.1, and 8.3. Existing P-series evidence and the five-findings
investigation were reviewed before new probes were run. The focused probes
used Node.js 22.15.0 with bundled nghttp2 1.64.0 on Windows. They created a
temporary standalone `node:http2` server so that request streams could be
held deliberately in the required state. This is the same Node/nghttp2
protocol layer used by Achieve's `listen2()` endpoint; the earlier P-series
and five-findings campaigns compared standalone Node and Achieve directly and
found identical protocol-layer outcomes except for the documented application
response timing race.

Each raw connection sent the client preface and SETTINGS, decoded actual
GOAWAY and RST_STREAM payloads, and used a valid control where applicable.
Selected failure cases were repeated with deterministic fragmentation across
the frame header and payload. Socket closure alone was not counted as an error
result. No Achieve implementation or test file was changed.

## Normative baseline

- Section 5.1.1 requires newly established stream identifiers to increase and
  requires `PROTOCOL_ERROR` for an unexpected new identifier. It also says
  identifiers cannot be reused, while section 5.1 permits minimal processing
  and discarding of frames that arrive on closed streams in specified races.
- Section 5.1.2 requires an excess new concurrent stream to receive a stream
  `PROTOCOL_ERROR` or `REFUSED_STREAM`.
- Sections 5.2 and 6.9 apply flow control to DATA payload octets, including
  padding, and exempt other frame types. A sender cannot exceed either window.
- Section 6.9.1 caps a window at `2^31-1` and assigns stream or connection
  `FLOW_CONTROL_ERROR` according to the affected window.
- Section 6.9.2 requires signed adjustment of every active stream window when
  `SETTINGS_INITIAL_WINDOW_SIZE` changes. If that adjustment overflows any
  stream window, the required result is a connection `FLOW_CONTROL_ERROR`.
- Sections 8.1 and 8.1.1 define a Content-Length/DATA-length mismatch as
  malformed and require a detected malformed message to receive stream
  `PROTOCOL_ERROR`.
- Section 8.3 forbids undefined pseudo-headers, response pseudo-headers in
  requests, and all pseudo-headers in trailers; these messages are malformed.

## Probe observations

| Probe | Controlled sequence | Expected | Observed |
| --- | --- | --- | --- |
| E01 | Advertise `MAX_CONCURRENT_STREAMS=1`; hold stream 1 open; open stream 3 | RST_STREAM 3 `PROTOCOL_ERROR` or `REFUSED_STREAM` | GOAWAY `INTERNAL_ERROR`, last stream 1 |
| E01-F | E01 with fragmented delivery | Same as E01 | Same GOAWAY `INTERNAL_ERROR` |
| E02 | Complete stream 1, then send HEADERS again on stream 1 | Closed-stream handling permitted by section 5.1; no new application request | Second block discarded; no second response and no connection failure |
| E03 | Add `0x7fffffff` to the initial connection send window | GOAWAY `FLOW_CONTROL_ERROR` | GOAWAY `FLOW_CONTROL_ERROR` |
| E04 | Keep stream 1 open; add `0x7fffffff` to its send window | RST_STREAM 1 `FLOW_CONTROL_ERROR`; connection survives | RST_STREAM 1 `FLOW_CONTROL_ERROR`, contiguous and fragmented |
| E05 | Send 100,000 response octets with both initial peer windows 65,535; withhold updates | At most 65,535 DATA octets before credit | Exactly 65,535; transmission resumed to 100,000 only after both updates |
| E06 | Advertise stream window 10 and connection window 65,535 | At most 10 DATA octets before stream credit | Exactly 10; stream WINDOW_UPDATE resumed transmission |
| E07 | Advertise stream window 100,000, retain connection window 65,535 | At most 65,535 DATA octets before connection credit | Exactly 65,535; connection WINDOW_UPDATE resumed transmission |
| E08 | Advertise receive stream window 32; send 33 DATA octets | RST_STREAM 1 `FLOW_CONTROL_ERROR` | RST_STREAM 1 `FLOW_CONTROL_ERROR` |
| E09 | Advertise receive stream window 32; send one data octet plus pad-length and 31 padding octets | All 33 payload octets count; stream error | RST_STREAM 1 `FLOW_CONTROL_ERROR`, contiguous and fragmented |
| E10 | Set peer initial window 0; open active response stream; change to 10, then 20 | 0, then 10, then 20 cumulative DATA octets | Exactly 0, 10, and 20 |
| E11 | Active window 0; WINDOW_UPDATE by 1; change initial window to `0x7fffffff` | GOAWAY `FLOW_CONTROL_ERROR` because adjustment overflows by one | RST_STREAM 1 `FLOW_CONTROL_ERROR`, contiguous and fragmented |
| E12 | Content-Length 4 and four DATA octets; then health stream | Normal request and usable connection | Normal response and health response |
| E13 | Content-Length 3 or 5 and four DATA octets; then health stream | RST_STREAM `PROTOCOL_ERROR`; connection remains usable | RST_STREAM 1 `PROTOCOL_ERROR`; stream 3 succeeded; fragmented short case agreed |
| E14 | `:status` in request, undefined `:foo`, or `:path` in trailers; then health stream | RST_STREAM `PROTOCOL_ERROR`; connection remains usable | Every case reset stream 1 with `PROTOCOL_ERROR`; stream 3 succeeded; fragmented trailer case agreed |

The attempted connection receive-window overflow did not establish the
conditional error case. Node emitted a connection WINDOW_UPDATE increment of
48,000 while receiving the request, before the sent DATA exceeded the updated
credit. Ignoring a WINDOW_UPDATE at the test application does not revoke
credit already placed on the wire, so treating that observation as an
overflow would be a probe artifact.

## Requirement decisions

### V3-9113-009 — Conformant

P17 already established that opening stream 3 and then a lower new stream 1
receives GOAWAY `PROTOCOL_ERROR`. E02 shows that a later HEADERS block on the
already closed stream is discarded rather than reused as a new request, which
is permitted by the closed-stream race rules. Achieve does not initiate push
streams, so no server-created identifier sequence remains to verify for its
supported origin-server behavior.

### V3-9113-011 — Unverified; inventory wording corrected

RFC 9113 does not contain the former ledger statement that a receiver “MAY
allow streams that were already opening concurrently” to exceed the limit.
Section 5.1.2 instead says an endpoint reducing its advertised limit below the
current number can close excess streams or allow them to complete. The ledger
wording and condition were corrected without changing the identifier or V2
mapping. E01 tests a new stream after an already advertised limit, not this
dynamic-limit reduction, so the corrected record remains Unverified.

### V3-9113-012 — Nonconformant

E01 deliberately held stream 1 open after the server advertised a limit of
one. New stream 3 exceeded that acknowledged limit. Node/nghttp2 sent
connection GOAWAY `INTERNAL_ERROR`, not stream `PROTOCOL_ERROR` or
`REFUSED_STREAM`. Fragmentation produced the same result. Achieve delegates
this state machine to Node/nghttp2; the finding applies to the assessed
Achieve 3.0.6 / Node 22.15.0 configuration.

### V3-9113-013 — Conformant

E05-E07 establish independent enforcement of the connection and stream send
windows. Response HEADERS and SETTINGS acknowledgements were transmitted even
while DATA was blocked at a zero stream window, establishing that the control
frames did not consume that credit. E09 establishes that pad length and
padding count in the DATA payload's flow-controlled length.

### V3-9113-014 — Unverified

P05-P24 and E03 show that all observed connection errors emitted GOAWAY before
closure. This is strong representative evidence, but the record quantifies
over every detected connection-error category and “when possible” condition.
The bounded corpus does not establish that universal claim. The generic-code
permission in section 5.4 also needs to be kept distinct from more specific
requirements elsewhere that assign a particular error type.

### V3-9113-015 — Nonconformant

Malformed request cases P31-P47 and E13-E14 correctly use RST_STREAM and leave
the connection usable. However, the controlled P24/five-findings case keeps a
nonzero stream open and then sends WINDOW_UPDATE(0); Node 22.15.0 sends
connection GOAWAY `INTERNAL_ERROR` instead of the stream reset assigned by
section 6.9. This one demonstrated counterexample is enough to reject the
broad requirement even though many other stream-error families pass. It is
the same underlying cause already recorded for `V3-9113-026`, not a separate
implementation bug.

### V3-9113-025 — Conformant

E03 and E04 crossed `2^31-1` separately for the connection and an open stream.
The observed GOAWAY and RST_STREAM carried `FLOW_CONTROL_ERROR` at the correct
scope. The stream case also passed fragmented delivery.

### V3-9113-027 — Conformant

E05 stopped at the common 65,535 credit. E06 isolated a ten-octet stream
window while connection credit remained available; E07 isolated the 65,535
connection window while stream credit was 100,000. No DATA exceeded either
window, and transmission resumed only after the corresponding WINDOW_UPDATE.

### V3-9113-028 — Unverified

E08 directly establishes stream-window exceedance handling with RST_STREAM
`FLOW_CONTROL_ERROR`. A connection-window exceedance could not be induced
without ignoring credit that Node had already advertised: Node replenished
the connection window while receiving buffered data. The connection branch
therefore remains unverified, and the combined ledger record is not promoted.

### V3-9113-029 — Nonconformant

E10 establishes correct signed adjustment of an active stream: no DATA at
zero credit, ten after the first setting change, and ten more after the next.
E11 then creates an active window of one and changes the initial size from
zero to `2^31-1`, overflowing by one. RFC 9113 requires a connection
`FLOW_CONTROL_ERROR`; Node/nghttp2 instead emits RST_STREAM 1
`FLOW_CONTROL_ERROR`. Contiguous and fragmented delivery agree. This is a
scope defect in Node/nghttp2, not Achieve application code.

### V3-9113-030 — Conformant

E12 is the exact-length control. E13 covers both a declared length below and
above the four DATA octets. Both mismatches are recognized as malformed and
produce stream `PROTOCOL_ERROR`; the later health stream succeeds.

### V3-9113-031 — Unverified

The existing P-series plus E13-E14 directly establish malformed handling for
uppercase names, prohibited connection fields, TE, pseudo-header ordering and
duplication, missing mandatory pseudo-headers, content-length mismatch,
undefined/context-invalid pseudo-headers, and invalid trailers. The ledger
row nevertheless summarizes every detected malformed request condition.
Representative successes do not prove the universal record, and no failing
case was demonstrated in this batch.

### V3-9113-039 — Conformant

P47 already covered a response pseudo-header in a request. E14 adds an
undefined pseudo-header and a request pseudo-header in trailers. Each was
treated as malformed with stream `PROTOCOL_ERROR`, and the connection remained
usable. Normal responses provide the valid sender control with only the
defined `:status` response pseudo-header.

## Classification changes and responsibility

| Requirement | Before | After | Primary layer |
| --- | --- | --- | --- |
| V3-9113-009 | Unverified | Conformant | Node/nghttp2 stream state |
| V3-9113-011 | Unverified | Unverified | Corrected inventory wording; dynamic Node/nghttp2 setting behavior |
| V3-9113-012 | Unverified | Nonconformant | Node/nghttp2 |
| V3-9113-013 | Unverified | Conformant | Node/nghttp2 flow control |
| V3-9113-014 | Unverified | Unverified | Node/nghttp2 error handling |
| V3-9113-015 | Unverified | Nonconformant | Node/nghttp2; shared cause with V3-9113-026 |
| V3-9113-025 | Unverified | Conformant | Node/nghttp2 flow control |
| V3-9113-027 | Unverified | Conformant | Node/nghttp2 sender |
| V3-9113-028 | Unverified | Unverified | Node/nghttp2 receiver |
| V3-9113-029 | Unverified | Nonconformant | Node/nghttp2 |
| V3-9113-030 | Unverified | Conformant | Node HTTP/2 parser |
| V3-9113-031 | Unverified | Unverified | Node/nghttp2 plus Achieve target checks |
| V3-9113-039 | Unverified | Conformant | Node/nghttp2 parser |

Nine records are resolved: six Conformant and three Nonconformant. Four remain
Unverified. The three new requirement-level nonconformities represent two new
observed causes (concurrency-limit handling and SETTINGS overflow scope) plus
the previously established WINDOW_UPDATE(0) stream-scope cause. They are not
three independent Achieve implementation defects.

## Limitations

- Results apply to Achieve 3.0.6 on Node.js 22.15.0/nghttp2 1.64.0. This batch
  did not generalize the new results to other Node versions.
- The standalone harness was necessary to hold application streams open and
  isolate flow-control state. Prior direct comparisons establish that Achieve
  does not interpose on this protocol layer.
- No deterministic supported-interface probe forced connection receive-window
  exceedance because Node replenished that window; V3-9113-028 remains
  Unverified rather than receiving an artificial pass.
- V3-9113-011 now states the actual dynamic-limit alternative, but that
  behavior still needs a focused SETTINGS reduction probe.

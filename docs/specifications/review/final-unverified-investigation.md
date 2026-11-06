# Final Investigation of Unverified Achieve 3.0.6 HTTP Requirements

## Scope and method

The corrected V3 baseline contained 211 requirements, including 14 classified
Unverified. This investigation reviewed all 14 against the exact RFC wording,
the Achieve 3.0.6 implementation, Batch A-F evidence, and the focused protocol
reports. The interrupted session ran one bounded local probe campaign on
Windows using Node.js 22.15.0, nghttp2 1.64.0, and OpenSSL 3.0.16. The resumed
session added one focused raw HTTP/2 connection-window probe on the same Node
and nghttp2 versions.

The probes were limited to conditions that could produce decisive evidence:
server-generated multi-frame field blocks, dynamic concurrent-stream setting
reduction, prohibited response fields, HPACK state following rejection of an
excessive field section, and TLS 1.2 cipher/curve support. Existing Batch F
renegotiation evidence was reassessed with implementation inspection. No new
probe was used to turn a broad universal requirement into Conformant from a
small sample.

## Complete initial inventory

| ID | Exact obligation represented by V3 | Evidence missing at the start |
|---|---|---|
| `V3-9110-001` | §2.2: a sender MUST NOT generate protocol elements that violate their ABNF. | An element-by-element inventory of every Achieve/Node-generated protocol element and every supported output path; existing captures are representative only. |
| `V3-9110-002` | §2.2: a sender MUST NOT generate syntax permitted only to a role it does not have. | A finite inventory of role-specific syntax and direct sender evidence for each applicable prohibition. |
| `V3-9110-003` | §2.3: recipients SHOULD parse defensively, making only marginal assumptions about conformance and size. | A defensible boundary for the broad recommendation and evidence across the identified marginal syntax/size families; no finite malformed corpus proves the universal wording. |
| `V3-9110-004` | §2.3: a recipient MUST accept an element at least as long as a value it generates for that same element. | Paired measurements of every generated element's maximum length against the corresponding receive limit. |
| `V3-9110-005` | §2.4: a recipient MUST interpret received elements according to their defined semantics absent a justified compatibility workaround. | A field/method/status-specific semantic inventory; the current record ranges over all received elements. |
| `V3-9113-005` | §4.3: a multi-frame field block MUST be sent as contiguous HEADERS or PUSH_PROMISE plus CONTINUATION frames without interleaving. | Raw capture of an Achieve-generated response field block large enough to require CONTINUATION. |
| `V3-9113-011` | §5.1.2: after reducing the advertised stream maximum below the open count, the endpoint can close excess streams or allow them to complete. | A dynamic SETTINGS reduction while multiple streams are already open. |
| `V3-9113-014` | §5.4.1: when possible, an endpoint detecting a connection error SHOULD send GOAWAY with the applicable code before closing. | Coverage or authoritative implementation evidence for the untested connection-error families and the conditional “when possible” boundary. |
| `V3-9113-028` | §6.9: a receiver MUST treat flow-control window exceedance as FLOW_CONTROL_ERROR at connection or stream scope as applicable. | A deterministic connection-window exceedance after accounting for every WINDOW_UPDATE already advertised by the receiver. Stream scope was already verified. |
| `V3-9113-031` | §8.1.1: a detected malformed request MUST be treated as stream PROTOCOL_ERROR. | Coverage for every malformed-request family encompassed by the composite wording, or decomposition into finite records. |
| `V3-9113-034` | §8.2.2: an endpoint MUST NOT generate an HTTP/2 message containing Connection, Proxy-Connection, Keep-Alive, Transfer-Encoding, or Upgrade. | Sender attempts and wire observations for all five named fields through the supported response interface. |
| `V3-9113-059` | §10.5.1: an excessive field block MUST still be processed sufficiently to maintain consistent connection state unless the connection is closed. | A rejected excessive block followed by a block whose HPACK decoding depends on state established by the rejected block. |
| `V3-9113-061` | §9.2.2: a TLS 1.2 HTTP/2 deployment MUST support TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 with P-256. | Proof that the already negotiated mandatory cipher can use P-256 specifically. |
| `V3-9113-062` | §9.2.1: a TLS 1.2 HTTP/2 deployment MUST disable renegotiation. | Evidence that client renegotiation is rejected plus inspection for any server-initiated Achieve path; the required error result is separately assessed by `V3-9113-053`. |

## Investigation groups and priority

### Group 1: bounded wire or TLS tests

These were highest priority because one controlled condition could directly
exercise the represented obligation: `V3-9113-005`, `011`, `034`, `059`, and
`061`. The probes used valid controls, observed actual HTTP/2 frames or TLS
negotiation properties, and kept sender/receiver and stream/connection scopes
separate.

### Group 2: implementation inspection plus existing direct evidence

`V3-9113-062` was resolvable without repeating the Batch F wire probe. Batch F
already demonstrated rejection of a client-initiated post-preface TLS 1.2
renegotiation. Inspection found no Achieve server-initiated renegotiation path.
The incorrect HTTP/2 error code is not hidden by this result; it remains the
separate `V3-9113-053` Nonconformant finding.

### Group 3: specialized test still required

`V3-9113-028` needs deterministic connection receive-window exhaustion. A
follow-up raw probe raised the stream window to 100,000, paused application
consumption, and sent well-formed DATA at and one octet beyond the initial
65,535-octet connection window. Node/nghttp2 automatically emitted connection
WINDOW_UPDATE credit in both contiguous and fragmented cases, so the peer did
not exceed the current credit actually advertised on the wire. A future test
needs a supported manual-flow-control mode or authoritative nghttp2-level
evidence.

### Group 4: normative decomposition or exhaustive inspection required

`V3-9110-001` through `005`, `V3-9113-014`, and `V3-9113-031` remain broad
composites. Existing evidence covers many concrete cases but not the complete
quantified obligation. More examples would increase breadth without making a
universal Conformant classification defensible. These records should remain
Unverified unless decomposed into finite obligations or supported by an
authoritative implementation proof covering the full boundary.

## Evidence and conclusions by requirement

### `V3-9110-001` — Unverified

Node centralizes HTTP/1.1 and HTTP/2 serialization, and existing wire captures
cover representative success and error responses. Applications can still
select many values through supported response APIs, and the record encompasses
all protocol ABNF. No finite corpus establishes the universal sender rule.
Resolution requires decomposition by generated element or a serializer/source
audit that defines the supported output boundary.

### `V3-9110-002` — Unverified

The record spans every syntax form reserved to another role. Existing proxy,
client, and origin-role corrections show why role must be assessed per
element, but do not form a complete sender inventory. It remains Unverified
pending decomposition into specific role-restricted constructs.

### `V3-9110-003` — Unverified

Request-target, field, size, and malformed-input probes demonstrate substantial
defensive behavior, but §2.3 is a broad SHOULD with an open-ended set of
marginal inputs and implementation limits. The investigation found no new
counterexample and no finite test boundary that would justify a universal
Conformant classification.

### `V3-9110-004` — Unverified

This comparison requires knowing the lengths Achieve/Node can generate for
each element and the limits accepted for the same element. Existing header and
target limits are not a complete same-element comparison. A future resolution
requires an explicit generated-element inventory and paired boundary tests.

### `V3-9110-005` — Unverified

The existing suites establish defined semantics for many methods, validators,
ranges, fields, and status paths, but the row still ranges over every received
element. No newly reviewed evidence closes that universal scope. Decomposition
by concrete semantic element is the defensible next step.

### `V3-9113-005` — Conformant

An Achieve servlet generated a 40,000-octet response field. Raw h2c capture
showed:

1. HEADERS on stream 1, length 16,384, without END_HEADERS;
2. immediately following CONTINUATION on stream 1, length 8,679, with
   END_HEADERS; and
3. DATA only after the field block completed.

No other frame type or stream was interleaved. This directly exercises the
sender obligation. Node/nghttp2 owns the framing; Achieve supplies response
fields through the compatibility API.

### `V3-9113-011` — Conformant

A Node HTTP/2 control held streams 1 and 3 open, changed the advertised
SETTINGS_MAX_CONCURRENT_STREAMS from unlimited to 1, and observed the peer
receive the new setting. Both already-open streams then completed normally.
This is one of the two outcomes the section permits. Achieve adds no handling
at this layer, so responsibility is Node/nghttp2. The result does not alter the
separate rule for opening a new stream after the reduced limit takes effect.

### `V3-9113-014` — Unverified

The P-series and Batch E evidence consistently show GOAWAY before closure for
the connection-error families exercised, including frame size, compression,
SETTINGS, stream identifier, and flow-control failures. The recommendation
also depends on whether sending GOAWAY is possible and spans connection-error
sources not exhaustively enumerated by the probes. No counterexample was
found, but bounded success is not universal proof.

### `V3-9113-028` — Unverified

Stream-window exceedance is directly verified as RST_STREAM
FLOW_CONTROL_ERROR. Connection-window exceedance is a possible peer protocol
violation: a peer can send validly framed DATA whose flow-controlled length
exceeds its current connection credit. The obstacle is not a protocol-level
impossibility. It is the tested implementation's automatic connection-window
replenishment and the lack of a supported manual-flow-control test hook.

The follow-up standalone Node.js probe configured a 100,000-octet stream
window so stream credit would not be the limiting scope, paused application
consumption, and compared:

- a 65,535-octet valid control;
- 65,536 octets sent contiguously; and
- 65,536 octets with the frame bytes fragmented into seven-octet TCP writes.

All three sequences used valid DATA frames no larger than 16,384 octets. In
every case Node/nghttp2 emitted connection WINDOW_UPDATE frames and
acknowledged a following PING; no GOAWAY occurred. The additional credit was
actually sent on the wire and therefore had to be counted by a conforming
peer. Ignoring it would not demonstrate window exceedance. Conversely,
lowering Node's unadvertised internal window would manufacture state the peer
could not know and would also be invalid evidence. Thus deliberate malformed
wire input is legitimate conformance testing, but neither of those two
shortcuts would trigger the RFC condition honestly. The connection branch
remains Unverified pending a supported manual-credit mode or authoritative
Node/nghttp2 evidence.

### `V3-9113-031` — Unverified

Existing probes cover uppercase names, connection-specific fields, invalid TE,
pseudo-header ordering and duplication, invalid pseudo-header contexts,
Content-Length mismatches, and malformed targets. They establish stream
PROTOCOL_ERROR and connection survival for those families. The record still
quantifies over all detected malformed requests, so it remains Unverified
until divided into finite malformed-message families or supported by broader
authoritative parser evidence.

### `V3-9113-034` — Conformant

An Achieve servlet attempted each field named by §8.2.2 through the supported
response API. Node dropped `Connection` with an UnsupportedWarning and emitted
a response without it. `Keep-Alive`, `Proxy-Connection`, `Transfer-Encoding`,
and `Upgrade` prevented a normal response field section; none appeared on the
wire. The same HTTP/2 session remained usable for a later request. Batch F
independently established Transfer-Encoding rejection. Operational failure to
produce a normal response for four attempts is outside this MUST NOT-generate
record and is not treated as a conformance benefit beyond the absent fields.

### `V3-9113-059` — Conformant

A raw HPACK sequence sent 130 incrementally indexed fields, ending with
`x-marker: marker-value`, in an excessive stream-1 request. Node reset that
stream with `ENHANCE_YOUR_CALM` but kept the connection open. Stream 3 then
used dynamic index 62, referring to the newest entry established by the
rejected block, and received a normal 200 response. No `COMPRESSION_ERROR`
occurred. Successful dependent decoding demonstrates that nghttp2 processed
the rejected field block sufficiently to preserve shared compression state.

### `V3-9113-061` — Conformant

Both peers were restricted to TLS 1.2,
`TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`, P-256 only, and ALPN `h2`. The Achieve
secure HTTP/2 handshake succeeded. The client reported TLS 1.2, ALPN `h2`, the
standard mandatory cipher name, and ephemeral ECDH `prime256v1` with a
256-bit key. This directly establishes support on the tested Node/OpenSSL
deployment. Operator-supplied TLS policy can still select other configurations;
the result establishes support, not universal correctness of every override.

### `V3-9113-062` — Conformant

Batch F's client-initiated TLS 1.2 renegotiation after the HTTP/2 preface did
not complete; the endpoint rejected it by closing the HTTP/2 connection.
Achieve contains no server-initiated renegotiation path. The deployment thus
disables renegotiation for the assessed configuration. The resulting GOAWAY
used `INTERNAL_ERROR` rather than required `PROTOCOL_ERROR`; that distinct
reaction obligation remains Nonconformant under `V3-9113-053` and is not
masked by this classification.

## Classification effect

Six requirements move from Unverified to Conformant:

- `V3-9113-005`
- `V3-9113-011`
- `V3-9113-034`
- `V3-9113-059`
- `V3-9113-061`
- `V3-9113-062`

Eight remain Unverified:

- `V3-9110-001` through `V3-9110-005`
- `V3-9113-014`
- `V3-9113-028`
- `V3-9113-031`

The inventory remains 211 records. Totals change from 151 Conformant and 14
Unverified to 157 Conformant and 8 Unverified; all other classification totals
are unchanged.

## Limitations and remaining work

- Results assigned to Node/nghttp2/OpenSSL are specific to Node.js 22.15.0,
  nghttp2 1.64.0, and OpenSSL 3.0.16 on Windows.
- The sender field-block capture establishes the applicable Achieve response
  path, not PUSH_PROMISE, which Achieve does not generate.
- The HPACK test establishes consistent state after the tested excessive-field
  rejection, not general denial-of-service resistance.
- A compliant supported cipher configuration does not prevent an operator
  from supplying a different TLS policy.
- Broad RFC 9110 and malformed-request composites need decomposition, not a
  larger but still finite success sample.
- Connection receive-window exceedance still needs a deterministic,
  credit-aware test.

All temporary probe scripts, application directories, listeners, and servers
were removed after the investigation.

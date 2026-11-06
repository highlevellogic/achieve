# RFC 9112 V2-H105 Investigation: Overlong Request Targets

## Conclusion

The original **Nonconformant** classification is **confirmed** for the supported Achieve 3.0.6 HTTP/1.1 endpoint on the tested runtime, Node.js v22.15.0.

A request whose request line alone contained a 17,001-octet request-target, with no header fields, received `431 Request Header Fields Too Large`. The same status was returned when a short request-target was accompanied by an oversized header field. Node reports both cases through the same `HPE_HEADER_OVERFLOW` parser error and its default server behavior maps that error to 431.

RFC 9112 §3 requires 414 when the request-target is longer than the server is willing to parse. The observed request-line-only case isolates the request-target as the cause; it is not an oversized request header field condition. Use of Node.js does not remove that obligation from the supported Achieve endpoint.

## Normative interpretation

### Overlong request-target

[RFC 9112 §3](https://www.rfc-editor.org/rfc/rfc9112.html#section-3) states:

> A server that receives a request-target longer than any URI it wishes to parse MUST respond with a 414 (URI Too Long) status code.

[RFC 9110 §15.5.15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.15) defines 414 as refusal because the target URI is longer than the server is willing to interpret. Therefore, once the operative rejection condition is excessive request-target length, 414 is mandatory.

### Oversized header fields

[RFC 9110 §5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4) separately says that a server receiving a request field line, field value, or set of fields larger than it wishes to process MUST respond with an appropriate 4xx status. It does not redefine the request line or request-target as a header field.

Contrary to the wording of the investigation request, RFC 9110 does **not** define status 431. `431 Request Header Fields Too Large` remains defined by [RFC 6585 §5](https://www.rfc-editor.org/rfc/rfc6585.html#section-5): the server is unwilling to process the request because its header fields are too large, either collectively or because one field is too large. That definition fits the oversized-field probe, but not a request line containing an overlong target and no fields.

### Malformed request line

An invalid request-line is a different condition. RFC 9112 §3 recommends 400 or a properly encoded 301 for an invalid request-line. The malformed-method control produced 400 and `HPE_INVALID_METHOD`; it did not produce the overflow error. This distinguishes syntax rejection from the size-limit behavior under investigation.

### Rejection before complete parsing

The RFC does not provide an exemption merely because an implementation applies an aggregate parser limit before constructing a complete request object. In the isolated request-line-only case, Node had already recognized and counted request-target bytes in its URL callback. The endpoint rejected because the target contribution crossed the configured parser limit. The correct externally visible status remains 414.

A genuinely ambiguous aggregate overflow can occur when target and field bytes jointly cross the limit. Such ambiguity affects the feasibility of an Achieve-level correction, but it does not change the result for a request whose request line alone exceeds the limit.

## Achieve and Node.js behavior

### Runtime and configuration

- Achieve version: 3.0.6.
- Runtime: Node.js v22.15.0.
- `http.maxHeaderSize`: 16,384 bytes.
- `NODE_OPTIONS`: unset during the probe.
- Achieve creates the HTTP/1.1 server with `http.createServer(achieveApp)` at `achieve.js:1559-1591`.
- Achieve does not pass a `maxHeaderSize` option and does not register a `clientError` listener.

The supported Node option `maxHeaderSize` overrides `--max-http-header-size` for requests received by a server. Achieve uses the Node default.

### Node parser implementation

Node v22.15.0 uses one counter for both URL and header field data:

- `src/node_http_parser.cc` calls `TrackHeader(length)` from `on_url`, `on_header_field`, and `on_header_value`.
- `TrackHeader` accumulates those lengths in `header_nread_` and raises `HPE_HEADER_OVERFLOW` when the shared count reaches `max_http_header_size_`.
- The public error is `HPE_HEADER_OVERFLOW` with reason `Header overflow`; it does not state whether URL bytes or field bytes caused the threshold crossing.

Node's documented default `clientError` behavior returns 431 for every `HPE_HEADER_OVERFLOW`. In v22.15.0, `lib/_http_server.js` selects the 431 response solely from that error code. Since Achieve has no listener, this default executes before `achieveApp` receives a request.

The supported `clientError` API exposes `code`, `bytesParsed`, and `rawPacket`. `rawPacket` is only the current packet being parsed, not a guaranteed complete request prefix. It can help diagnose an unfragmented request but does not reliably identify the request-target for fragmented input.

## Reproduction method

The probe used one temporary application containing `index.html`, Achieve's ordinary production HTTP startup, loopback TCP only, and bounded two-second socket timeouts. Each request used a separate connection. A second, otherwise equivalent server attached a temporary `clientError` listener to record the supported error properties and reproduce Node's documented default 431/400 mapping. A third server located the boundary by binary search.

Lengths below include CRLF in the request-line measurement and include the complete request line, fields, and terminating CRLF in the total header-block measurement. They are wire measurements, not Node's internal counter value.

| Case | Target length | Request-line bytes | Total header-block bytes | Response | Connection/result | Parser error |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Normal `/index.html` | 11 | 26 | 64 | 200 | `Connection: close`; orderly end | none |
| Long target below parser boundary | 16,001 | 16,016 | 16,054 | 404 | `Connection: close`; request reached Achieve | none |
| Target exceeds aggregate boundary | 17,001 | 17,016 | 17,054 | 431 | `Connection: close`; orderly end | `HPE_HEADER_OVERFLOW` |
| Short target, oversized `X-Fill` field | 11 | 26 | 17,074 | 431 | `Connection: close`; orderly end | `HPE_HEADER_OVERFLOW` |
| Request line alone exceeds limit; no fields | 17,001 | 17,016 | 17,018 | 431 | `Connection: close`; orderly end | `HPE_HEADER_OVERFLOW` |
| Malformed method control | 11 | 27 | 65 | 400 | `Connection: close`; orderly end | `HPE_INVALID_METHOD` |

### Boundary observations

With fixed `Host: localhost` and `Connection: close` fields:

- largest accepted target: 16,355 octets; request line 16,370 bytes; total header block 16,408 bytes;
- first target rejected with 431: 16,356 octets; request line 16,371 bytes; total header block 16,409 bytes.

With `/index.html` fixed and only the `X-Fill` value varied:

- largest accepted fill value: 16,338 octets; total header block 16,412 bytes;
- first fill value rejected with 431: 16,339 octets; total header block 16,413 bytes.

The wire totals can exceed 16,384 because Node's internal counter tracks URL and header name/value callback data rather than every request-line delimiter and protocol token.

### Supported error-interface observations

For the unfragmented 17,001-octet target, `clientError` reported:

- code: `HPE_HEADER_OVERFLOW`;
- reason: `Header overflow`;
- `bytesParsed`: 17,005;
- `rawPacket`: the full 17,054-byte packet, beginning with the request line.

For the oversized field, the code and reason were identical. Only inspection of the packet contents distinguished the cases.

When the long-target request was transmitted in 1,024-byte fragments, the same overflow produced:

- code: `HPE_HEADER_OVERFLOW`;
- `bytesParsed`: 621 for the current parser invocation;
- `rawPacket`: 670 bytes beginning in the middle of the target, without the method or start of the request line.

This demonstrates that `rawPacket` alone cannot reliably classify the overflow as target-related. The fragmented packet happened to include the request-line terminator, but it lacked the beginning needed to parse the target safely.

## Conformance assessment

The 431 response is conformant for the short-target/oversized-field case: an oversized field set requires an appropriate 4xx, and 431 precisely describes that condition.

The 431 response is not conformant for the request-line-only overlong-target case. The request contains no header fields, the parser counts target bytes through its URL callback, and RFC 9112 mandates 414 for the demonstrated condition. Therefore `V2-H105` remains **Nonconformant**, with two qualifications:

1. the defect is in the behavior of the supported Achieve HTTP/1.1 endpoint even though Node's parser and default error mapping produce it;
2. aggregate overflow cases containing both a long target and large fields can be ambiguous, and this investigation does not assign a single required status to every such mixed case.

## Remedy feasibility (not implemented)

### 1. `clientError` handler using only `error.code`

Not sufficient. Both target overflow and field overflow are `HPE_HEADER_OVERFLOW`. Returning 414 for every such error would misdescribe genuine oversized-field requests. Returning 431 preserves the confirmed target defect.

### 2. Inspect `rawPacket` in `clientError`

Feasible as a limited improvement for a complete, unfragmented request line. If the current packet contains an unambiguous complete request line from its beginning, Achieve could distinguish an overlong target and send 414. It is not a complete correction because the documented `rawPacket` is only the current parser buffer; fragmentation can remove the request-line prefix.

Any handler would also become responsible for safely formatting and closing the raw socket response because no `request` or `response` object exists at `clientError` time.

### 3. Configure a larger Node `maxHeaderSize` and enforce an Achieve target limit after parsing

This uses supported APIs and could cover targets between an explicit Achieve target limit and the enlarged aggregate parser limit. It does not eliminate the problem: a still-larger target eventually crosses the finite Node aggregate limit first and receives the generic overflow error. Raising the aggregate limit also increases accepted parser memory and attack surface and should not be done solely to hide the boundary.

### 4. Buffer request-line bytes per connection before parser failure

An Achieve listener could retain a bounded prefix of incoming bytes so `clientError` can reconstruct the request line across packet boundaries. This avoids a custom HTTP parser but duplicates part of parser input handling, adds per-connection memory/work, and needs careful treatment of pipelining, TLS, malformed input, and request-smuggling boundaries. It is not a straightforward localized change.

### 5. Node.js enhancement

The cleanest robust solution would be for Node/llhttp to expose a distinct URL/request-target overflow error or parser-state metadata through `clientError`, allowing applications to map target overflow to 414 and field overflow to 431. No such distinction is exposed by the tested supported API.

## Recommended engineering disposition

Retain `V2-H105` as a confirmed nonconformity. Before changing Achieve, evaluate whether an upstream Node issue or enhancement already exists for distinguishing URL overflow. An Achieve-level `clientError` correction based only on `rawPacket` would be partial and must be described and tested as such; returning 414 for every `HPE_HEADER_OVERFLOW` is not recommended.

If a complete local remedy is required, first design a bounded, fragmentation-safe request-line observation mechanism and assess its security and performance cost. The current evidence does not justify silently increasing `maxHeaderSize` or introducing a custom HTTP parser.

## Limitations

- Runtime observations were performed on Node.js v22.15.0 on Windows; other supported Node 22 patch releases were not probed.
- The investigation did not modify Node or inspect live llhttp state beyond the supported error properties.
- Boundary values depend on the exact fixed fields and Node's internal accounting; they are evidence of the shared limit, not a new public Achieve limit.
- HTTPS was not separately probed because it uses the same Node HTTP parser after TLS and the issue is parser classification, not transport framing. A future regression test should nevertheless exercise both HTTP and HTTPS if a correction is implemented.
- No implementation remedy was tested.

## Validation and cleanup

The probe server was stopped, the temporary application directory was removed, and the temporary probe source was deleted. No Achieve source, tests, ledger, or existing assessment document was changed.

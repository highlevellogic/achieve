# RFC 9112 V2-H105: Node.js Upstream and Supported-API Investigation

## Executive conclusion

Node.js does not currently provide a supported API or configuration that reliably distinguishes an overlong request-target from oversized header fields at the HTTP/1.1 parser-error boundary. Node.js v22.15.0 and the locally available v24.22.1 both apply one aggregate `maxHeaderSize` counter to URL and header-field callback data, report both failures as `HPE_HEADER_OVERFLOW`, and return 431 by default.

The behavior is known upstream. [nodejs/node#26296](https://github.com/nodejs/node/issues/26296) reported in 2019 that a long URI should produce 414 rather than 400. The issue discussion identified the shared `HPE_HEADER_OVERFLOW` code and observed that Node could distinguish the phases internally by tracking whether URL or header callbacks had occurred. Nevertheless, the issue was closed in 2023 as fixed by [nodejs/node#25605](https://github.com/nodejs/node/pull/25605), whose actual change was the generic mapping of every `HPE_HEADER_OVERFLOW` from 400 to 431. That change did not implement the 414 distinction. No later merged or released correction was found, and the current Node source retains the same shared accounting and default mapping.

The cleanest complete remedy belongs upstream in Node.js. Node's binding already knows whether it is accounting URL bytes or header-field bytes and could expose a distinct error classification or phase. llhttp need not become a second parser in Achieve, and Achieve should not add one. Pending an upstream correction, documenting the limitation is preferable to a partial `clientError` heuristic that can fail under TCP fragmentation.

## Applicable protocol requirement

[RFC 9112 §3](https://www.rfc-editor.org/rfc/rfc9112.html#section-3) requires a server that receives a request-target longer than any URI it wishes to parse to respond with 414. [RFC 9110 §15.5.15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.15) defines 414 for that condition. Oversized fields are different: [RFC 9110 §5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4) requires an appropriate 4xx for excessive field lines, field values, or sets of fields, and [RFC 6585 §5](https://www.rfc-editor.org/rfc/rfc6585.html#section-5) defines 431 specifically for header fields that are too large.

The prior focused investigation established a request-line-only case in which the request-target itself crossed Node's accepted limit and the supported Achieve endpoint returned 431. This report addresses where that behavior originates and whether a supported correction exists.

## Upstream findings

### Historical issue and response change

- [nodejs/node#26296](https://github.com/nodejs/node/issues/26296), “HTTP GET Request with a long URI produces a 400 Bad Request error (should be 414),” directly describes the semantic issue. It is closed with reason `completed`.
- A maintainer explained that Node 12 would return 431 instead, via [nodejs/node#25605](https://github.com/nodejs/node/pull/25605), but also stated that URL and field overflow had the same `HPE_HEADER_OVERFLOW` code.
- Another maintainer noted that Node could distinguish the conditions internally by observing the URL callback before any status or header-field callback, but considered the additional complexity not worthwhile at that time.
- The final 2023 comment closed the issue as fixed by #25605. However, #25605 deliberately maps `HPE_HEADER_OVERFLOW` to 431; it does not add a 414 path. Node's [v12.0.0 release proposal](https://github.com/nodejs/node/pull/26930) likewise describes the change as “return HTTP 431 on HPE_HEADER_OVERFLOW error.”

Thus, the upstream issue is highly relevant but was closed without resolving the RFC 9112 status-code distinction. The closure appears to treat replacement of generic 400 with 431 as resolution; that is not a resolution of an overlong request-target requiring 414.

### Current Node implementation

In Node [v22.15.0 `src/node_http_parser.cc`](https://github.com/nodejs/node/blob/v22.15.0/src/node_http_parser.cc), `on_url`, `on_header_field`, and `on_header_value` all call the same `TrackHeader(length)` method. `TrackHeader` accumulates into one `header_nread_` counter and raises `HPE_HEADER_OVERFLOW` after the configured aggregate limit is reached. Node's [v22.15.0 server implementation](https://github.com/nodejs/node/blob/v22.15.0/lib/_http_server.js) maps that error code to 431 when the application has not installed a `clientError` listener.

The same structure remains in current Node source: [`on_url` and the field callbacks share `TrackHeader`](https://github.com/nodejs/node/blob/main/src/node_http_parser.cc), and the server's default classification remains based on `HPE_HEADER_OVERFLOW`. Inspection of the v24.22.1 sources and the local v24.22.1 runtime found no separate request-target overflow error. No release note or merged pull request implementing a request-target/field distinction was found.

### llhttp capabilities

llhttp exposes separate streaming callbacks for URL, header-field, and header-value data, including `on_url` and `on_url_complete`; see the [llhttp API](https://github.com/nodejs/llhttp#api). Its public parser error enumeration includes syntax errors such as `HPE_INVALID_URL` and generic callback errors, but no dedicated URL-length or request-target-overflow error. The `URI_TOO_LONG` symbol visible in generated headers is an HTTP status-code name, not a parser errno.

The aggregate byte limit at issue is imposed in Node's C++ HTTP binding while processing those distinct callbacks. Therefore an upstream fix can be made in Node without first changing llhttp: Node can preserve phase-specific state or emit a Node-specific error when its limit is crossed during `on_url`. A dedicated llhttp error could also provide a reusable abstraction, but it is not necessary for Node to distinguish its own limit.

The evidence supports describing the behavior as an incidental consequence of shared accounting and a generic default mapping, not as an llhttp requirement. The upstream discussion acknowledges the distinction and explicitly declined its complexity; that is stronger evidence than an inference from the code alone.

## Supported APIs and configuration

### `maxHeaderSize` and `--max-http-header-size`

Node documents [`http.maxHeaderSize`, `--max-http-header-size`, and the per-server `maxHeaderSize` option](https://nodejs.org/api/http.html#httpmaxheadersize). The per-server option overrides the process-wide value and defaults to 16 KiB. Despite its name and documentation in terms of headers, the implementation's counter also includes URL data.

Changing this limit is not a complete remedy:

1. Increasing it allows previously rejected targets to reach the application.
2. Every finite replacement limit still produces the same generic overflow when a still-longer target reaches it.
3. An application-level target limit below the enlarged aggregate limit could return 414 after successful parsing, but cannot classify targets that cross Node's aggregate limit first.
4. A larger aggregate limit also accepts more field data and increases parser memory/exposure unless separate controls are added.

The local probes confirmed this. With `maxHeaderSize: 32768`, a 17,001-character target changed from 431 to 200, but a 34,001-character target again produced `HPE_HEADER_OVERFLOW` and 431. A 34,000-character field produced the same error and status.

### `clientError`

Node's documented [`clientError` event](https://nodejs.org/api/http.html#event-clienterror) provides an `Error`, the socket, `bytesParsed`, and `rawPacket`. It provides no parsed request or response object; a listener assumes responsibility for writing a valid response and closing or destroying the socket. The documented default returns 431 for `HPE_HEADER_OVERFLOW`.

For the two overflow classes, the supported error properties are not sufficient for a reliable classifier:

- `code` is `HPE_HEADER_OVERFLOW` in both cases.
- `reason` is `Header overflow` in both cases.
- `bytesParsed` is relative to the parser invocation and does not identify the request phase.
- `rawPacket` is documented as the current packet, not the complete bytes accumulated for the request.

An unfragmented request might be classified by parsing the beginning of `rawPacket`, but the fragmented probe crossed the limit in a later packet. Its `rawPacket` began inside the target, and `bytesParsed` was 8,000 for that invocation rather than a complete request offset. The supported event therefore cannot distinguish the condition safely for arbitrary TCP segmentation.

### Parser callbacks and separate limits

The public `node:http` server API does not expose `on_url`, `on_header_field`, or parser-phase callbacks. It does not expose a request-target-only byte limit, a header-fields-only byte limit, or the internal URL byte count. `insecureHTTPParser` changes parser strictness and is unrelated to size classification. Request timeouts likewise do not separate these byte domains.

No supported configuration-only solution was found.

## Local version comparison

Two already-installed runtimes were tested with a temporary standalone `node:http`/`node:net` probe on Windows x64. No dependency or runtime was installed. Each case used a fresh loopback connection and a bounded timeout.

| Case | Node 22.15.0 | Node 24.22.1 | `clientError` classification |
| --- | --- | --- | --- |
| Normal target | 200 | 200 | none |
| 16,001-character target | 200 | 200 | none |
| 17,001-character target, default 16 KiB limit | 431 | 431 | `HPE_HEADER_OVERFLOW` |
| 17,000-character field, default limit | 431 | 431 | `HPE_HEADER_OVERFLOW` |
| Fragmented 17,001-character target | 431 | 431 | `HPE_HEADER_OVERFLOW`; current packet began mid-target |
| 17,001-character target, 32 KiB limit | 200 | 200 | none |
| 34,001-character target, 32 KiB limit | 431 | 431 | `HPE_HEADER_OVERFLOW` |
| 34,000-character field, 32 KiB limit | 431 | 431 | `HPE_HEADER_OVERFLOW` |

For the unfragmented 17,001-character target, both versions reported `bytesParsed: 17005`; for the corresponding oversized field, both reported `bytesParsed: 17022`. For the fragmented target, both reported `bytesParsed: 8000` and a current `rawPacket` of 8,022 bytes lacking the request-line prefix. The identical results demonstrate that the issue persists in the locally available current Node 24 release; they do not by themselves prove behavior in every Node release line or platform.

## Remedy comparison

| Approach | Correct distinction | Fragmentation | Persistent connections and pipelining | Complexity / burden | Fully resolves §3? |
| --- | --- | --- | --- | --- | --- |
| **A. Configuration (`maxHeaderSize`)** | No; it only moves a shared boundary | Irrelevant to classification | Existing parser behavior retained | Low, but changes accepted byte volume and attack surface | No |
| **A. `clientError` using code/properties only** | No; code and reason are shared | `rawPacket` can omit the request prefix | Listener must close/destroy the socket; no request object exists | Low for generic response, unreliable for classification | No |
| **B. Achieve parses current `rawPacket`** | Sometimes, for complete unfragmented prefixes | No | Error terminates the current connection; pipelined bytes can complicate packet interpretation | Moderate and fragile | No |
| **B. Achieve observes/buffers request-line prefixes per connection** | Potentially | Yes, with bounded cross-chunk state | Must reset state correctly for keep-alive and pipelined requests and avoid disagreement with Node's parser | High; duplicates security-sensitive framing logic and adds per-connection work/memory | Potentially, but effectively introduces a second request-line parser |
| **C. Node emits phase-specific overflow** | Yes | Yes; parser binding owns cross-chunk state | Node can preserve established parser/error lifecycle and close behavior | Localized upstream change plus compatibility/tests | Yes for Node's own limit |
| **C. llhttp adds a dedicated error/limit** | Yes | Yes | Parser maintains the necessary state | Broader API/design change; Node integration still required | Yes after Node adopts it |
| **D. Document limitation pending upstream fix** | Does not correct behavior | N/A | No runtime impact | Very low | No; accurately records known nonconformance |

### Connection consequences

A parser overflow occurs before a request object is emitted. Node's default response closes the connection. A custom `clientError` listener is documented as responsible for closing or destroying the socket; attempting to continue a persistent connection after a fatal parser error would be unsafe. Pipelined requests following the failed message therefore cannot be preserved by a simple status remapping. An upstream error distinction would not need to change this lifecycle; it would only select 414 versus 431 before closure.

## Recommended next action

1. Treat V2-H105 as a confirmed endpoint limitation until the externally visible status changes.
2. Raise a new, narrowly framed Node.js issue (or request reopening of #26296) because the existing issue was closed on the mistaken premise that generic 431 resolves the 414 requirement. Reference #26296 and #25605 rather than duplicating their history.
3. Request a phase-specific supported error from Node—preferably a distinct error code such as `HPE_URL_OVERFLOW` or an explicit parser phase/property—while retaining the existing aggregate byte limit if maintainers prefer it.
4. Do not add a second request-line parser to Achieve. Do not return 414 for all `HPE_HEADER_OVERFLOW` errors because that would misclassify genuine field overflow.
5. While awaiting upstream resolution, document the Node limitation in the conformance assessment. A partial unfragmented-packet heuristic is not recommended as a standards fix.

The appropriate primary fix is in Node's binding, not Achieve application code. The binding creates the ambiguity while already possessing the callback context required to avoid it. A Node correction could be consumed by Achieve through the documented `clientError` interface with a small, robust status mapping.

## Draft upstream issue

The historical issue does not adequately cover the present state because it is closed as completed even though current Node returns 431 rather than the RFC-required 414. The following draft is suitable for a new issue or a request to reopen #26296. It has not been submitted.

### Title

`node:http` returns 431 instead of RFC-required 414 for request-target overflow

### Body

````markdown
### Version

Reproduced on Node.js v22.15.0 and v24.22.1 on Windows x64.

### Description

`node:http` applies `maxHeaderSize` to request-target bytes as well as header-field bytes. When a request-target alone crosses that limit, Node reports `HPE_HEADER_OVERFLOW` and its default server behavior sends `431 Request Header Fields Too Large`.

RFC 9112 §3 requires: “A server that receives a request-target longer than any URI it wishes to parse MUST respond with a 414 (URI Too Long) status code.”

The same error code is used for actual oversized fields, for which 431 is appropriate. The supported `clientError` event does not expose parser phase, and `rawPacket` is only the current parser buffer, so applications cannot reliably distinguish the cases when input is fragmented.

This is related to #26296. That issue was closed as fixed by #25605, but #25605 changed generic overflow from 400 to 431; it did not add the required 414 distinction.

### Minimal reproduction

```js
const http = require('node:http');
const net = require('node:net');

const server = http.createServer((req, res) => res.end('ok'));
server.on('clientError', (err, socket) => {
  console.log(err.code, err.reason, err.bytesParsed, err.rawPacket.length);
  socket.end('HTTP/1.1 431 Request Header Fields Too Large\r\n' +
             'Connection: close\r\nContent-Length: 0\r\n\r\n');
});

server.listen(0, '127.0.0.1', () => {
  const socket = net.createConnection(server.address().port, '127.0.0.1');
  socket.on('connect', () => {
    socket.end(`GET /${'a'.repeat(17000)} HTTP/1.1\r\nHost: x\r\n\r\n`);
  });
  socket.on('close', () => server.close());
});
```

Observed error: `HPE_HEADER_OVERFLOW`, reason `Header overflow`. Without a `clientError` listener Node automatically sends 431.

### Expected behavior / API

Node should make request-target overflow distinguishable from header-field overflow (for example, a distinct error code or documented parser-phase property), and its default server behavior should send 414 for the former and 431 for the latter.

The distinction needs to be maintained in parser state so it works for fragmented TCP input. Inspecting `rawPacket` in userland is not reliable because it can begin in the middle of the request-target.

### References

- RFC 9112 §3: https://www.rfc-editor.org/rfc/rfc9112.html#section-3
- Existing issue: https://github.com/nodejs/node/issues/26296
- Generic 431 change: https://github.com/nodejs/node/pull/25605
````

## Source references

- [RFC 9112 §3 — Request Target](https://www.rfc-editor.org/rfc/rfc9112.html#section-3)
- [RFC 9110 §15.5.15 — 414 URI Too Long](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.15)
- [RFC 9110 §5.4 — Field Limits](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4)
- [RFC 6585 §5 — 431 Request Header Fields Too Large](https://www.rfc-editor.org/rfc/rfc6585.html#section-5)
- [Node.js HTTP API — `clientError`, `maxHeaderSize`, and `http.maxHeaderSize`](https://nodejs.org/api/http.html)
- [Node.js v22.15.0 HTTP parser binding](https://github.com/nodejs/node/blob/v22.15.0/src/node_http_parser.cc)
- [Node.js v22.15.0 HTTP server default error mapping](https://github.com/nodejs/node/blob/v22.15.0/lib/_http_server.js)
- [Current Node.js HTTP parser binding](https://github.com/nodejs/node/blob/main/src/node_http_parser.cc)
- [llhttp public API and callbacks](https://github.com/nodejs/llhttp#api)
- [nodejs/node#26296](https://github.com/nodejs/node/issues/26296)
- [nodejs/node#25605](https://github.com/nodejs/node/pull/25605)
- [Node.js v12.0.0 release proposal](https://github.com/nodejs/node/pull/26930)

## Investigation limitations

- Runtime comparison was limited to the already-installed Node.js v22.15.0 and v24.22.1 on Windows x64; no runtime was installed.
- Repository and release searches can miss discussion using unrelated terminology. No merged or released phase-specific overflow correction was found, and the current implementation plus Node 24 observation independently confirm that none is active there.
- The probe tested isolated requests and one fragmented target. It did not exhaust every segmentation or pipelining pattern because the shared supported error classification was already demonstrated.
- No Node.js issue or pull request was opened.

## Cleanup and validation

The standalone probe used loopback only, all servers were closed, and the temporary probe source was removed. No Achieve implementation, test, ledger, prior assessment, or specification page was changed.

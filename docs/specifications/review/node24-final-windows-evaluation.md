# Final Windows evaluation of Node.js 24.22.2 for Achieve 3.0.6

## Recommendation

Node.js 24.22.2 is a **defensible Windows upgrade candidate** for Achieve
3.0.6, subject to the Linux release gates below. The complete Achieve verifier
passes without a compatibility regression, and the runtime corrects four
demonstrated HTTP/2 nonconformities plus the connection-level half of a fifth.

The upgrade does not make the assessed endpoint fully conformant. Several
Node/nghttp2/parser findings remain, including wrong error scope for open-stream
`WINDOW_UPDATE(0)` and excess concurrent streams, request-target 431 versus
414, CONNECT 405 without `Allow`, and TLS renegotiation rejection without the
required `GOAWAY(PROTOCOL_ERROR)`. These are known limitations rather than new
general Achieve compatibility regressions.

## Evaluated runtime

| Component | Version |
|---|---:|
| Node.js | 24.22.2, Windows x64 |
| OpenSSL | 3.5.9 |
| nghttp2 | 1.70.0 |
| llhttp | 9.4.3 |
| V8 | 13.6.233.17-node.63 |

The official Windows archive was verified against Node's published SHA-256:

```text
ca1bff5d8ead13c9f2ea404a176db46bd430704d5b5113734049fa365e7799e2
```

The Windows Firewall prompt was separately investigated. It created inbound
application rules but did not prevent localhost protocol traffic: all affected
runs acknowledged a precondition PING, and no-renegotiation controls
acknowledged consecutive PINGs. The post-renegotiation PING failure is specific
to the rejected TLS handshake, not firewall interference.

## Complete Achieve verifier

The established aggregate was invoked directly with the Node.js 24.22.2
executable:

```powershell
node-v24.22.2-win-x64\node.exe tests/run-verifiers.js
```

| Discovered | Passed | Failed | Declared case skips | Duration |
|---:|---:|---:|---:|---:|
| 37 | 37 | 0 | 6 | 38.749 seconds |

The six declared skips are the established Windows symlink/`EPERM` cases in
`tests/physical_containment`; no new skip or failure appeared. HTTP, HTTPS,
h2c, secure HTTP/2, static resources, compression, conditional requests,
ranges, servlets, routing, logging, error completion, containment, and startup
tests all passed.

The run used the current development working tree, including the already
reviewed but uncommitted HTTP 205 and matching-If-Range corrections. It proves
compatibility for that tree rather than an unmodified npm tarball alone.

## Exact-runtime protocol results

Focused standalone Node probes exercised behavior delegated below Achieve's
ordinary request dispatch. Existing Achieve endpoint comparisons establish
that these parser and HTTP/2 compatibility-layer results are externally
observable through Achieve.

### HTTP/1.1

| Finding | Node.js 24.22.2 observation | Result |
|---|---|---|
| `V3-9112-006`, oversized request-target | A 20,001-character target produced `HPE_HEADER_OVERFLOW` and HTTP 431. | Unresolved; RFC 9112 §3 requires 414 for the target-length condition. |
| `V3-9112-017`, unknown non-final transfer coding | `Transfer-Encoding: frobnicate, chunked` produced 200; the handler received `Wiki` after chunk decoding. | Unresolved SHOULD-level finding. |

### HTTP/2 response generation

| Finding | Node.js 24.22.2 observation | Result |
|---|---|---|
| `V3-9110-098`, classic CONNECT 405 | Compatibility handler was not invoked; response contained `:status 405` and `date`, but no `allow`. | Unresolved. |

### HTTP/2 state and errors

All error values below are decoded GOAWAY or RST_STREAM codes from the wire.

| Finding / probe | Node.js 24.22.2 observation | Assessment relative to Node 22.15.0 |
|---|---|---|
| `V3-9113-008`, even client stream ID | Connection GOAWAY `PROTOCOL_ERROR` (`0x1`). | Corrected. |
| `V3-9113-019`, `ENABLE_PUSH=2` | Connection GOAWAY `PROTOCOL_ERROR`. | Corrected for tested setting. |
| `V3-9113-019`, `MAX_FRAME_SIZE=16383` | Connection GOAWAY `PROTOCOL_ERROR`. | Corrected for tested setting. |
| `V3-9113-020`, client PUSH_PROMISE | Connection GOAWAY `PROTOCOL_ERROR`. | Corrected. |
| `V3-9113-026`, connection `WINDOW_UPDATE(0)` | Connection GOAWAY `PROTOCOL_ERROR`. | Connection facet corrected. |
| `V3-9113-015` / `026`, open-stream `WINDOW_UPDATE(0)` | Connection GOAWAY `PROTOCOL_ERROR`, not stream RST_STREAM. | Wrong scope remains. |
| `V3-9113-012`, stream exceeding advertised concurrency limit | Connection GOAWAY `PROTOCOL_ERROR`, not the required stream error. | Error code improved; wrong scope remains. |
| `V3-9113-029`, active-window overflow | Connection GOAWAY `FLOW_CONTROL_ERROR` (`0x3`). | Corrected. |

Because stream-scope counterexamples remain, the composite `V3-9113-007`
state/error record is only partially improved and remains unresolved for this
candidate.

### TLS 1.2 and HTTP/2

The focused renegotiation investigation is authoritative over the earlier
runtime report's mistaken “accepted renegotiation” interpretation:

- Node 24.22.2 rejects post-preface renegotiation with
  `ERR_TLS_RENEGOTIATION_DISABLED`.
- The renegotiation callback is not invoked and a subsequent HTTP/2 PING is not
  acknowledged.
- No GOAWAY is emitted and the connection does not promptly close.
- Consecutive PINGs are acknowledged normally when no renegotiation is
  attempted.

Thus renegotiation is disabled, but `V3-9113-053` remains unresolved because
the required connection `PROTOCOL_ERROR` is not transmitted.

For `V3-9113-056`, explicitly weakening both peers to
`AES128-SHA:@SECLEVEL=0` negotiated TLS 1.2 with ALPN `h2`, selected prohibited
`TLS_RSA_WITH_AES_128_CBC_SHA`, and received server SETTINGS. Node 24.22.2 does
not impose the HTTP/2 cipher blacklist over explicit application TLS policy.

## Nonconformity impact summary

No V3 classifications are changed by this runtime evaluation; the ledger
continues to describe the assessed Achieve 3.0.6 / Node 22.15.0 baseline.

### Corrected by Node 24.22.2 in the tested cases

- `V3-9113-008` — invalid client stream parity error code.
- `V3-9113-019` — tested invalid SETTINGS error codes.
- `V3-9113-020` — client PUSH_PROMISE error code.
- `V3-9113-029` — active stream-window overflow scope and code.

### Partially corrected

- `V3-9113-026` — connection `WINDOW_UPDATE(0)` is corrected; stream
  `WINDOW_UPDATE(0)` still has connection rather than stream scope.
- `V3-9113-007` — several component errors are corrected, but retained
  counterexamples prevent resolving the composite.
- `V3-9113-012` — error code changes from `INTERNAL_ERROR` to
  `PROTOCOL_ERROR`, but the required stream scope is still wrong.

### Unresolved

- `V3-9110-098` — HTTP/2 CONNECT 405 omits `Allow`.
- `V3-9112-006` — request-target overflow returns 431 rather than 414.
- `V3-9112-017` — unknown request transfer coding is accepted.
- `V3-9113-015` — stream error is emitted as a connection error.
- remaining stream facet of `V3-9113-026`.
- `V3-9113-053` — renegotiation rejection lacks required GOAWAY code/closure.
- `V3-9113-056` — prohibited TLS 1.2 cipher remains negotiable under an
  explicitly weakened policy.

## Compatibility regressions

No regression affecting Achieve's established behavior was found by the 37
suite aggregate. The raw probes found no new Node 24.22.2 failure relative to
the corrected interpretation of TLS renegotiation. The stalled TLS connection
after rejected renegotiation remains operationally inferior to a prompt
protocol-error close, but successful renegotiation was not demonstrated.

## Remaining Linux release gates

Before changing Achieve's recommended runtime or minimum version:

1. run all 37 suites under the exact Node 24.22.2-or-later candidate on the
   supported Linux CI environment;
2. repeat the raw HTTP/2 parity, SETTINGS, PUSH_PROMISE, connection/stream
   `WINDOW_UPDATE(0)`, concurrent-stream, and active-window-overflow probes;
3. repeat request-target overflow, unknown transfer coding, and CONNECT 405
   field inspection;
4. repeat TLS 1.2 post-preface renegotiation, recording TLS errors, GOAWAY,
   closure timing, and post-attempt PING behavior;
5. verify default and explicitly weakened TLS 1.2 cipher policies with that
   platform's OpenSSL build; and
6. run package installation and supported startup/shutdown smoke tests with the
   actual release artifact.

Linux remains necessary because OpenSSL integration, socket error timing,
filesystem behavior, and symlink coverage differ from Windows.

## Final Windows decision

Node.js 24.22.2 passes the Windows compatibility gate and materially improves
the demonstrated HTTP/2 protocol behavior. It can proceed to Linux release
qualification. It should not yet be adopted as the documented production
baseline until those cross-platform gates pass and the remaining upstream
limitations are accepted or remediated.

No implementation, test, dependency, package metadata, runtime requirement,
public documentation, or conformance classification was changed.

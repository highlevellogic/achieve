# HTTP/2 TLS 1.2 renegotiation investigation

## Conclusion

The apparent Node.js 24 security/protocol regression reported in
`node-runtime-upgrade-evaluation.md` is **not confirmed**. Node.js 24.22.1 and
24.22.2 do not successfully complete post-preface TLS 1.2 renegotiation. In
both versions, the HTTP/2 server-side TLS socket emits
`ERR_TLS_RENEGOTIATION_DISABLED`.

The earlier probe interpretation was incorrect. It initialized no explicit
“callback not called” state and later rendered an unset callback-error value as
`null`. That was read as a successful callback. The refined probe records the
return value, callback invocation, TLS Finished values, server error, HTTP/2
frames, connection state, and post-attempt traffic separately. It establishes
that:

- the client requested renegotiation;
- OpenSSL/Node initiated client-side handshake work;
- the server recognized and rejected the attempt;
- renegotiation did not complete successfully; and
- HTTP/2 was not usable after the attempt.

There remains an RFC 9113 section 9.2.1 error-handling defect. Node.js 22.15.0
closes the connection with `GOAWAY(INTERNAL_ERROR)`, not the required
`PROTOCOL_ERROR`. Node.js 24.22.1 and 24.22.2 emit the TLS rejection error but,
within the bounded observation, send no GOAWAY and do not promptly close the
socket. The latter connection is stalled rather than usable. This does not
permit successful renegotiation, but it still does not implement the required
HTTP/2 connection error.

Node.js 24 therefore remains a viable upgrade candidate with respect to the
feared renegotiation-security regression. Adoption still requires Linux
confirmation and resolution or explicit acceptance of the remaining
`V3-9113-053` error-mapping defect.

## Normative requirement

[RFC 9113 section 9.2.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2.1)
contains two distinct mandatory obligations relevant here:

1. an HTTP/2 deployment over TLS 1.2 **MUST disable renegotiation**; and
2. an endpoint **MUST treat a TLS renegotiation as a connection error of type
   `PROTOCOL_ERROR`**.

The investigation therefore distinguishes rejection of renegotiation from the
HTTP/2 reaction used to terminate the connection. Rejecting the TLS handshake
does not by itself establish the required GOAWAY code.

## Previous probe and interpretation defect

The prior probe used a raw TLS 1.2 client, sent the HTTP/2 connection preface
and SETTINGS, called `TLSSocket.renegotiate()`, waited for a callback or a
timeout, and inspected HTTP/2 frames.

Its reliable observations for Node.js 24.22.1 were:

- `renegotiate()` returned `true`;
- no GOAWAY was observed;
- the socket remained open during a short observation; and
- no client-side TLS error was emitted.

Those facts establish that the client initiated an attempt, not that the peer
accepted it or that the handshake completed. The callback-result variable was
unset when the timeout won. A later null-coalescing presentation converted
that absence to `null`, which was incorrectly described as a successful
callback. No post-renegotiation HTTP/2 request or PING had established
continued usability.

The refined probe uses the documented Node contract: `renegotiate()` returning
`true` means the process was initiated, while its callback is invoked on the
`secure` event when renegotiation completes. A null callback argument would
mean success; absence of callback is not success. See the
[Node TLS `renegotiate()` documentation](https://nodejs.org/api/tls.html#tlssocketrenegotiateoptions-callback).

## Refined method

For each runtime, the standalone probe:

1. created a secure Node HTTP/2 server restricted to TLS 1.2;
2. connected a raw `TLSSocket` with ALPN `h2`;
3. sent the complete HTTP/2 client preface and initial SETTINGS;
4. waited for server SETTINGS and SETTINGS ACK;
5. sent PING payload `BEFORE01` and required its ACK, proving the HTTP/2
   connection was usable before the attempt;
6. captured client and server TLS Finished values;
7. called `TLSSocket.renegotiate()` and separately recorded its Boolean return,
   callback invocation, `secure` events, TLS errors, and updated Finished
   values;
8. sent PING payload `AFTER001` if the socket remained writable and waited for
   an ACK; and
9. decoded all returned HTTP/2 frames, especially GOAWAY and its error code.

The Node.js 24.22.2 case was also exercised through Achieve's secure
`listen2()` endpoint. An extended standalone observation left the connection
under observation for approximately ten seconds after the attempt.

All tests used the existing repository test certificate and
`TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`. They were local-only and bounded.

## Runtime provenance

| Runtime | Platform | OpenSSL | nghttp2 | Source |
|---|---|---:|---:|---|
| Node.js 22.15.0 | Windows x64 | 3.0.16 | 1.64.0 | Existing project runtime |
| Node.js 24.22.1 | Windows x64 | 3.5.9 | 1.70.0 | Existing Codex runtime cache |
| Node.js 24.22.2 | Windows x64 | 3.5.9 | 1.70.0 | Official temporary binary |

Node.js 24.22.2 was identified as the latest available Node 24 LTS patch from
the [official Node release listing](https://nodejs.org/en/blog/release). The
official `node-v24.22.2-win-x64.zip` and `SHASUMS256.txt` were downloaded from
`https://nodejs.org/dist/v24.22.2/`. Its SHA-256 was verified before execution:

```text
ca1bff5d8ead13c9f2ea404a176db46bd430704d5b5113734049fa365e7799e2
```

The downloaded binary reported Node.js 24.22.2, OpenSSL 3.5.9, nghttp2 1.70.0,
and llhttp 9.4.3.

## Comparison matrix

| Observation | Node 22.15.0 standalone | Node 24.22.1 standalone | Node 24.22.2 standalone | Node 24.22.2 Achieve |
|---|---|---|---|---|
| TLS / ALPN | TLS 1.2 / `h2` | TLS 1.2 / `h2` | TLS 1.2 / `h2` | TLS 1.2 / `h2` |
| Pre-attempt PING ACK | Yes | Yes | Yes | Yes |
| `renegotiate()` return | `true` | `true` | `true` | `true` |
| Server TLS result | `ERR_TLS_RENEGOTIATION_DISABLED` | `ERR_TLS_RENEGOTIATION_DISABLED` | `ERR_TLS_RENEGOTIATION_DISABLED` | `ERR_TLS_RENEGOTIATION_DISABLED` |
| Completion callback observed | No | No | No | No |
| Additional successful `secure` event | No | No | No | No |
| Both peers' Finished values changed | No; connection closed | No | No | No |
| Successful renegotiation established | No | No | No | No |
| Post-attempt PING ACK | No | No | No | No |
| HTTP/2 usable afterward | No | No | No | No |
| GOAWAY | `INTERNAL_ERROR` (`0x2`) | None observed | None observed | None observed |
| Connection closure | Prompt | Not within bounded observation | Not within ~10 seconds | Not within bounded observation |

### Requested versus completed

`renegotiate()` returned `true` in every case. Per Node's API, this establishes
that the client initiated the process. It does not establish server acceptance
or completion.

On Node 24, the client's local Finished value changed, but its peer Finished
value and the server's reciprocal values did not. The callback attached to the
next successful `secure` event was never invoked. This is evidence of an
incomplete handshake, consistent with the server's explicit
`ERR_TLS_RENEGOTIATION_DISABLED` event.

### Connection usability

The pre-attempt PING was acknowledged for every runtime. The identical
post-attempt PING was not acknowledged by any runtime. Node 22 closed after a
GOAWAY. Node 24 left the socket superficially open but made no observable
HTTP/2 progress. Thus “socket not yet destroyed” must not be interpreted as
“renegotiated connection remains usable.”

## Wire and layer interpretation

### Node.js / TLS layer

The server-side `ERR_TLS_RENEGOTIATION_DISABLED` is direct evidence that Node's
TLS socket has renegotiation disabled. Node documents
`TLSSocket.disableRenegotiation()` as causing an error event when the peer
attempts renegotiation. The exact server setup is performed by Node's HTTP/2
secure server; Achieve supplies TLS options and its request listener but does
not implement TLS handshakes.

### OpenSSL

OpenSSL performs the TLS handshake and exposes the renegotiation attempt to
Node. The comparison does not support attributing successful renegotiation to
OpenSSL 3.5.9: no successful second handshake occurred. The client-side local
Finished change without a matching peer Finished value indicates partial
handshake activity, not mutual completion.

### nghttp2 / Node HTTP/2 integration

The HTTP/2 error reaction differs by runtime even though renegotiation is
rejected in all cases. Node 22/nghttp2 1.64 emits GOAWAY with the generic wrong
code `INTERNAL_ERROR`. Node 24/nghttp2 1.70 emits no GOAWAY within the bounded
observation and leaves the transport stalled. Mapping the TLS rejection to the
required `GOAWAY(PROTOCOL_ERROR)` belongs in Node's secure HTTP/2 integration;
Achieve receives no ordinary request on which it could safely repair this.

The evidence does not isolate whether the Node 24 no-GOAWAY behavior originates
in a Node binding change, nghttp2 integration, or OpenSSL 3.5 error lifecycle.
It does establish that an Achieve request-handler change is not the appropriate
remedy.

## Reproducible commands

The temporary probe was run from the Achieve development worktree as follows
(the script itself was removed after the investigation):

```powershell
C:\programs\nodejs\node.exe tmp-http2-tls-renegotiation.js standalone
C:\Users\roger\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tmp-http2-tls-renegotiation.js standalone
C:\Users\roger\AppData\Local\Temp\node-v24.22.2-eval\node-v24.22.2-win-x64\node.exe tmp-http2-tls-renegotiation.js standalone
C:\Users\roger\AppData\Local\Temp\node-v24.22.2-eval\node-v24.22.2-win-x64\node.exe tmp-http2-tls-renegotiation.js achieve
```

The Node.js 24.22.2 archive was obtained and verified with:

```powershell
curl.exe --fail --location --output SHASUMS256.txt https://nodejs.org/dist/v24.22.2/SHASUMS256.txt
curl.exe --fail --location --output node-v24.22.2-win-x64.zip https://nodejs.org/dist/v24.22.2/node-v24.22.2-win-x64.zip
Get-FileHash -Algorithm SHA256 node-v24.22.2-win-x64.zip
```

The probe's essential logic is independently reproducible with only built-in
modules: create a TLS-1.2-only `http2.createSecureServer()`, open a raw
`tls.connect()` socket negotiating `h2`, exchange the preface, SETTINGS, and a
PING, call `renegotiate()`, then record the callback, Finished values, TLS
errors, GOAWAY frames, closure, and a second PING ACK.

## Linux availability

No suitable local Linux execution environment was available. WSL is not
installed, and neither Docker nor Podman is present. Installing a subsystem or
container runtime would exceed this investigation's scope. No claim is made
about Linux behavior.

A Linux reproduction remains required because OpenSSL integration and socket
error timing can differ by platform even with the same Node and library
versions.

## Assessment of the apparent regression

### Refuted claim

The evidence refutes the earlier statement that Node.js 24.22.1 “accepted” or
“completed” prohibited TLS 1.2 renegotiation. It did neither. The apparent
security regression was a probe-state interpretation error.

### Confirmed remaining defect

The tested runtimes still fail the second part of RFC 9113 section 9.2.1:

- Node 22 sends GOAWAY with `INTERNAL_ERROR`, not `PROTOCOL_ERROR`.
- Node 24.22.1 and 24.22.2 reject renegotiation at TLS level but do not send a
  GOAWAY and do not promptly close the stalled connection in the observed
  interval.

This remains a reproducible Node secure-HTTP/2 protocol defect for
`V3-9113-053`. This report does not change its classification.

### Security significance

No successful renegotiated TLS session or usable post-renegotiation HTTP/2
connection was demonstrated. The feared weakening of renegotiation
disablement is therefore not supported. The Node 24 behavior can retain a
stalled connection longer than Node 22, which is an error handling and
resource-lifetime concern, but it is not evidence that prohibited TLS
renegotiation succeeded.

## Production-upgrade implications

Node 24 remains a viable upgrade candidate. The previously reported blocker
should be narrowed from “renegotiation succeeds” to “renegotiation is rejected
without the required HTTP/2 GOAWAY/closure behavior.” That remaining defect
already falls within the known upstream remediation category and does not
erase Node 24's demonstrated HTTP/2 error-code improvements.

Before adoption:

1. repeat this refined probe on Node.js 24.22.2 or later on Linux;
2. verify whether the no-GOAWAY/stalled connection persists without any
   diagnostic listeners beyond those required to prevent an unhandled process
   error;
3. measure the default server timeout that ultimately disposes of the stalled
   TLS socket, without weakening the requirement for GOAWAY(PROTOCOL_ERROR);
4. add a permanent raw TLS/HTTP2 regression test that distinguishes initiation,
   completion, GOAWAY code, closure, and post-attempt usability; and
5. complete the other runtime-upgrade gates documented in
   `node-runtime-upgrade-evaluation.md`.

## Concise upstream issue draft

**Title:** `node:http2` rejects post-preface TLS 1.2 renegotiation without
`GOAWAY(PROTOCOL_ERROR)`

**Versions/platform:** Windows x64; Node.js 22.15.0 / OpenSSL 3.0.16 /
nghttp2 1.64.0, Node.js 24.22.1 and 24.22.2 / OpenSSL 3.5.9 / nghttp2 1.70.0.

**Reproduction:** Start a TLS-1.2-only `http2.createSecureServer()`. Connect a
raw `TLSSocket` with ALPN `h2`, exchange the HTTP/2 preface and SETTINGS, and
confirm a PING ACK. Call client `TLSSocket.renegotiate()`. Record server TLS
errors and decode returned HTTP/2 frames.

**Expected:** RFC 9113 section 9.2.1 requires the attempted renegotiation to be
treated as a connection `PROTOCOL_ERROR`; the peer should receive GOAWAY error
code `0x1` and the connection should terminate.

**Actual:** All tested servers emit `ERR_TLS_RENEGOTIATION_DISABLED`, so the
renegotiation does not complete. Node 22 additionally sends
`GOAWAY(INTERNAL_ERROR)` (`0x2`) and closes. Node 24.22.1 and 24.22.2 send no
GOAWAY within the bounded observation, do not acknowledge a following PING,
and leave the socket open. The client renegotiation callback is never invoked.

**Why this matters:** TLS renegotiation is correctly disabled, but the
mandatory HTTP/2 connection-error code and deterministic connection teardown
are missing or incorrect. A minimal standalone reproduction uses only
`node:http2`, `node:tls`, and a test certificate.

No upstream issue was filed as part of this investigation.

## Remaining uncertainties

- Linux behavior is not yet measured.
- The exact Node/nghttp2/OpenSSL change responsible for Node 24's stalled
  no-GOAWAY state is not isolated.
- The eventual default-timeout behavior beyond the bounded observation was not
  measured.
- A diagnostic listener was used to capture the server TLS error. The same
  listener arrangement was used across runtimes, and the TLS rejection itself
  is unambiguous, but final upstream reproduction should also document behavior
  under Node's minimal default listener configuration.
- No conformance classification, implementation, dependency, package metadata,
  or runtime requirement was changed.

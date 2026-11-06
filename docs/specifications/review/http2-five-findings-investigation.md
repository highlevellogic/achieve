# HTTP/2 Five-Findings Confirmation and Root-Cause Investigation

## Executive summary

The original wire observations were genuine on the assessed Node.js 22.15.0 runtime, but they do not represent five independent Achieve defects.

- On **Node 22.15.0 / nghttp2 1.64.0**, both a standalone `node:http2` server and Achieve 3.0.6 emitted `GOAWAY(INTERNAL_ERROR)` for all nine tested protocol-error cases. Eight required connection-scoped `PROTOCOL_ERROR`; the ninth required stream-scoped `RST_STREAM(PROTOCOL_ERROR)`.
- On **Node 24.22.1 / nghttp2 1.70.0**, standalone Node and Achieve emitted the correct `GOAWAY(PROTOCOL_ERROR)` for the eight connection-scoped cases.
- On Node 24.22.1, a zero-increment WINDOW_UPDATE on an open nonzero stream still emitted connection-scoped `GOAWAY(PROTOCOL_ERROR)`, not the required stream-scoped `RST_STREAM(PROTOCOL_ERROR)`. The error code is corrected, but the scope remains wrong.
- Achieve's request callback was not invoked for any connection-level malformed frame. Standalone Node reproduced every result. Achieve application logic is therefore not the source.

Four findings, plus the connection-level part of V3-9113-026, share a Node receive-callback close bug fixed by [nodejs/node#64166](https://github.com/nodejs/node/pull/64166). The fix defers close/send activity until `nghttp2_session_mem_recv()` returns, preserving nghttp2's already selected protocol error. It was released on the Node 22 line in [v22.23.3](https://github.com/nodejs/node/releases/tag/v22.23.3) and is present in Node 24.22.1 through the Node 24 backports [#65264](https://github.com/nodejs/node/pull/65264) and [#65093](https://github.com/nodejs/node/pull/65093).

The remaining stream-scope defect is in the nghttp2 receive path: both bundled nghttp2 versions call connection-error handling for a zero increment on a nonzero stream. No existing upstream issue located in this investigation adequately reports that receiver-side scope error.

## Normative requirements

The authoritative source is [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html).

| Finding | Applicable RFC text and level | Required result |
| --- | --- | --- |
| V3-9113-007: frame/state validation | SETTINGS (§6.5), HEADERS (§6.2), and PING (§6.7) each **MUST** use stream 0 or nonzero as specified; the cited invalid stream-ID cases **MUST** be treated as connection errors of type `PROTOCOL_ERROR`. | GOAWAY `PROTOCOL_ERROR`; connection closes. |
| V3-9113-008: stream parity | Under §5.1.1, client-initiated streams use odd identifiers. A server receiving a new even client stream **MUST** treat this as a connection error of type `PROTOCOL_ERROR`. | GOAWAY `PROTOCOL_ERROR`. |
| V3-9113-019: setting ranges | Under §6.5.2, SETTINGS_ENABLE_PUSH values other than 0 or 1 and SETTINGS_MAX_FRAME_SIZE outside 16,384..16,777,215 **MUST** be treated as connection errors of type `PROTOCOL_ERROR`. | GOAWAY `PROTOCOL_ERROR`. |
| V3-9113-020: server receives PUSH_PROMISE | Under §6.6, a server receiving PUSH_PROMISE **MUST** treat it as a connection error of type `PROTOCOL_ERROR`. | GOAWAY `PROTOCOL_ERROR`. |
| V3-9113-026: zero WINDOW_UPDATE | Under §6.9, increment 0 **MUST** be a `PROTOCOL_ERROR`. If stream ID is 0, it is a connection error; if the error is on a stream, it is a stream error under §5.4.2. | Stream 0: GOAWAY `PROTOCOL_ERROR`. Nonzero valid stream: RST_STREAM `PROTOCOL_ERROR`, while the connection remains usable. |

Sending GOAWAY before a connection close is a **SHOULD** under §5.4.1, but the five findings concern mandatory error codes and, for stream WINDOW_UPDATE, mandatory scope. `INTERNAL_ERROR` is not a permitted substitute for an error explicitly assigned `PROTOCOL_ERROR`.

## Methodology and harness validation

Two server configurations were run under each runtime:

1. Minimal standalone `http2.createServer()`.
2. Achieve 3.0.6 using `listen2()` with an isolated temporary application directory.

Runtime matrix:

| Runtime | Bundled nghttp2 | Server configurations |
| --- | --- | --- |
| Node.js 22.15.0 | 1.64.0 | standalone and Achieve |
| Node.js 24.22.1 | 1.70.0 | standalone and Achieve |

Each connection sent the exact 24-byte client preface `PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n`, followed by an empty client SETTINGS frame. A valid control produced server SETTINGS, SETTINGS ACK, response HEADERS, response DATA, and END_STREAM on both runtimes and both server configurations.

Each malformed case was repeated twice as one contiguous write and twice with deterministic multi-size TCP chunks. Thus each case had four observations per runtime/server configuration. Chunking preserved byte order and frame boundaries at the HTTP/2 layer; it only changed transport delivery. The second run used an 800 ms bound, removing timeouts observed with the prototype's byte-at-a-time sender.

The harness decoded the 9-byte frame header and GOAWAY/RST_STREAM payload directly. Error codes used the registry in RFC 9113 §7. A socket close without a decoded error frame was not accepted as evidence. Except for the documented Achieve stream-lifecycle race below, contiguous and fragmented delivery agreed.

For the stream WINDOW_UPDATE case, stream 1 was opened using valid HEADERS with END_HEADERS set and END_STREAM clear. The standalone handler consumed but did not answer the incomplete request, keeping stream 1 open. This removes the prior race in which a completed response could close the stream before the malformed WINDOW_UPDATE was processed.

## Exact wire inputs

Every sequence below followed the connection preface and empty SETTINGS frame. Multi-byte integers are network byte order.

| Case | V3 record | Malformed frame sequence (hex) | Expected |
| --- | --- | --- | --- |
| SETTINGS on stream 1 | 007 | `000000040000000001` | GOAWAY `PROTOCOL_ERROR` |
| HEADERS on stream 0 | 007 | `000014010500000000828684010f3132372e302e302e313a3234383930` | GOAWAY `PROTOCOL_ERROR` |
| PING on stream 1 | 007 | `0000080600000000013132333435363738` | GOAWAY `PROTOCOL_ERROR` |
| Even client stream 2 | 008 | `000014010500000002828684010f3132372e302e302e313a3234383930` | GOAWAY `PROTOCOL_ERROR` |
| ENABLE_PUSH=2 | 019 | `000006040000000000000200000002` | GOAWAY `PROTOCOL_ERROR` |
| MAX_FRAME_SIZE=16383 | 019 | `000006040000000000000500003fff` | GOAWAY `PROTOCOL_ERROR` |
| Client PUSH_PROMISE | 020 | `00001805040000000100000002828684010f3132372e302e302e313a3234383930` | GOAWAY `PROTOCOL_ERROR` |
| WINDOW_UPDATE(0), connection | 026 | `00000408000000000000000000` | GOAWAY `PROTOCOL_ERROR` |
| Open stream 1; WINDOW_UPDATE(0), stream 1 | 026 | `000014010400000001828684010f3132372e302e302e313a3234383930 00000408000000000100000000` | RST_STREAM 1 `PROTOCOL_ERROR`; connection usable |

The request HPACK block in the table is a valid static-indexed `GET`, `http`, `/` block followed by literal `:authority` for the local port. The malformed frame was the first intentional protocol violation in every connection.

## Reproduction results

### Connection-level cases

The first eight cases were identical within each runtime across standalone/Achieve, contiguous/fragmented delivery, and both repetitions.

| Runtime | Actual wire result | Application callback |
| --- | --- | --- |
| Node 22.15.0 standalone | GOAWAY `INTERNAL_ERROR` | Not invoked |
| Node 22.15.0 Achieve | GOAWAY `INTERNAL_ERROR` | Not invoked |
| Node 24.22.1 standalone | GOAWAY `PROTOCOL_ERROR` | Not invoked |
| Node 24.22.1 Achieve | GOAWAY `PROTOCOL_ERROR` | Not invoked |

The valid control invoked the callback exactly once in all four configurations. This confirms that callback instrumentation worked and that the malformed connection-level frames were rejected before application dispatch.

### Stream WINDOW_UPDATE(0)

| Runtime/configuration | Whole-frame result | Fragmented result | Interpretation |
| --- | --- | --- | --- |
| Node 22.15 standalone | GOAWAY `INTERNAL_ERROR` | Same | Wrong code and wrong connection scope. |
| Node 22.15 Achieve | GOAWAY `INTERNAL_ERROR` | One run GOAWAY; one run RST_STREAM `NO_ERROR` followed by successful stream 3 | Achieve's immediate static response can close/cancel the request stream before the fragmented invalid frame is processed. Use the standalone open-stream result for protocol-layer scope. |
| Node 24.22 standalone | GOAWAY `PROTOCOL_ERROR` | Same | Correct code, wrong connection scope. |
| Node 24.22 Achieve | GOAWAY `PROTOCOL_ERROR` | RST_STREAM `NO_ERROR` followed by successful stream 3 | Same application-response race; it does not disprove the standalone protocol result. |

The standalone server is decisive because it deliberately leaves stream 1 open. Both Node versions terminate the connection. RFC 9113 §6.9 requires only the affected stream to receive `PROTOCOL_ERROR` when the stream ID is nonzero.

## Standalone Node versus Achieve

There was no Achieve-specific difference for any connection-level candidate. The same bytes produced the same GOAWAY code, no request callback, and the same repeatability under standalone Node.

The only apparent difference was the fragmented stream WINDOW_UPDATE case. It is a probe/application timing interaction, not an Achieve protocol correction: Achieve can complete the static response while the client request remains open, causing Node to cancel or close stream 1 before the fragmented WINDOW_UPDATE arrives. The standalone server's deliberately open stream removes that ambiguity and reproduces the wrong connection scope consistently.

Achieve creates the Node servers in `achieve.js:1463-1512`; it does not parse frames or HPACK. Its compatibility callback at `achieve.js:1407-1441` runs only after Node/nghttp2 accepts a request. No supported Achieve callback can replace an already transmitted protocol-layer GOAWAY.

## Root cause

### Node 22 `INTERNAL_ERROR` substitution

Node's native `OnInvalidFrame` callback passes nghttp2 protocol errors into JavaScript. `onSessionInternalError()` calls `session.destroy(new NghttpError(...))`. In Node 22.15.0, `Http2Session.destroy(error)` supplies `INTERNAL_ERROR` when no explicit HTTP/2 code is passed, and native `Http2Session::Close()` immediately calls `nghttp2_session_terminate_session()` and flushes while still inside `nghttp2_session_mem_recv()`.

This can replace nghttp2's already queued, correct GOAWAY with a newly initiated `INTERNAL_ERROR` GOAWAY. The behavior is common to all eight connection-level cases; it is not eight parser decisions independently choosing the wrong code.

[Node PR #64166](https://github.com/nodejs/node/pull/64166) fixed a broader use-after-free problem by marking the session as receiving and deferring send/close/destroy until `nghttp2_session_mem_recv()` returns. Although the PR was motivated by memory safety rather than RFC error-code translation, preserving nghttp2's queued GOAWAY also corrects these wire error codes. The upstream commit is [46de80de88c6](https://github.com/nodejs/node/commit/46de80de88c6ab0fc1fa27aa4d51804c7e989da4).

The Node 24 line received dedicated adaptations in [f43bed0ecc4f](https://github.com/nodejs/node/commit/f43bed0ecc4f091b35743edefed896f0fe7f557c) and [83a27559cdc9](https://github.com/nodejs/node/commit/83a27559cdc9054b2e4b1418b1624249cf198c5d). The Node 22 backport is [7c2df5dd9680](https://github.com/nodejs/node/commit/7c2df5dd9680873231a52f068c314947d99e910f); official release history shows it first included in v22.23.3.

Therefore, the Node 22.15 behavior is a Node native-binding lifecycle defect, not an Achieve application defect and not evidence that nghttp2 originally selected `INTERNAL_ERROR` for those connection-level cases.

### Stream WINDOW_UPDATE scope

The bundled nghttp2 source in both tested versions explicitly routes zero increment through `session_handle_invalid_connection()` in `session_on_stream_window_update_received()`. That queues GOAWAY. For a nonzero stream, RFC 9113 §6.9 instead requires a stream error.

Node 22's receive-callback close problem then changes the code to `INTERNAL_ERROR`. Node 24 preserves nghttp2's chosen `PROTOCOL_ERROR`, but it cannot change the already wrong connection scope. This is a separate nghttp2 conformance issue.

[nghttp2 issue #369](https://github.com/nghttp2/nghttp2/issues/369) quotes the same normative rule, but it addressed a client tool *sending* increment 0 and was closed in 2015. It does not cover the current receiver-side connection-versus-stream behavior.

## Classification decisions

| V3 ID | Recommendation | Reason |
| --- | --- | --- |
| V3-9113-007 | **Confirmed Nonconformant for the assessed Node 22.15 endpoint.** Split the broad row before recording newer-runtime evidence. | Multiple specified connection errors used the wrong code on Node 22.15. Node 24.22 passes those cases, but the stream WINDOW_UPDATE subcase still has wrong scope and the broad state table is not fully covered. |
| V3-9113-008 | **Confirmed Nonconformant on Node 22.15; Conformant for the tested server-side parity obligation on Node 24.22.** | Exact even-stream case repeated at the wire. The V3 baseline describes Achieve on Node 22.15, so its proposed Nonconformant classification is supported. |
| V3-9113-019 | **Confirmed Nonconformant on Node 22.15; Conformant for the two tested ranges on Node 24.22.** | Both invalid values produced INTERNAL_ERROR on 22 and PROTOCOL_ERROR on 24. Other setting ranges remain outside this focused confirmation. |
| V3-9113-020 | **Confirmed Nonconformant on Node 22.15; Conformant for this exact obligation on Node 24.22.** | Client PUSH_PROMISE produced the required connection PROTOCOL_ERROR on Node 24 only. |
| V3-9113-026 | **Confirmed Nonconformant on both runtimes.** | Connection-level increment 0 is corrected in newer Node. Nonzero-stream increment 0 still causes GOAWAY rather than RST_STREAM, including with the stream intentionally held open. |

No proposed finding is wholly rejected. The refinement is that four are runtime-version-specific manifestations of one fixed Node defect, while V3-9113-026 contains an additional, still-current nghttp2 scope defect. The V3 ledger should preserve runtime qualifiers if classifications are later updated.

## Upstream history and recommended reporting

No new Node issue is needed for the Node 22 `INTERNAL_ERROR` substitution. The responsible receive/close path has already been fixed and backported. Recommended action for Achieve is to:

1. Document that malformed-frame error-code conformance on early Node 22 releases is limited by Node, with Node 22.23.3 or later recommended for the corrected behavior.
2. Retain the Node 22.15 evidence in the historical assessment because that was the expressly assessed runtime.
3. Re-run this small corpus when Achieve changes its minimum or CI Node version.

The nonzero-stream WINDOW_UPDATE issue warrants an nghttp2 report. A Node tracking issue could follow if Node maintainers need to carry or expose the upstream correction, but Node's public API cannot distinguish and repair the frame before nghttp2 sends GOAWAY.

### Draft nghttp2 issue

**Title:** Receiving WINDOW_UPDATE with increment 0 on a nonzero stream sends GOAWAY instead of RST_STREAM

**Description:**

RFC 9113 §6.9 requires a WINDOW_UPDATE with increment 0 to be a `PROTOCOL_ERROR`; errors on a nonzero stream are stream errors, while only the connection flow-control window uses a connection error. With nghttp2 1.70.0 in server mode, after opening stream 1 and keeping it open, sending:

```text
00 00 04 08 00 00 00 00 01 00 00 00 00
```

causes `GOAWAY(PROTOCOL_ERROR)` and closes the connection. Expected behavior is `RST_STREAM(stream=1, PROTOCOL_ERROR)` with the connection remaining usable. The behavior is repeatable with contiguous and fragmented TCP delivery. Current `session_on_stream_window_update_received()` appears to call `session_handle_invalid_connection()` when `window_size_increment == 0`; the connection-level branch correctly uses connection handling, but the nonzero-stream branch appears to require stream handling. nghttp2 issue #369 concerned generating an invalid outbound frame and does not appear to cover this receiver-side scope issue.

Include a minimal C or Node reproducer plus the exact preface/SETTINGS/HEADERS/WINDOW_UPDATE bytes when filing. Do not combine the older Node `INTERNAL_ERROR` overwrite in the same report; that was fixed separately by nodejs/node#64166.

## Limitations

- h2c was used because the tested obligations apply after HTTP/2 establishment. TLS does not alter frame parsing in the compared Node/nghttp2 layer; h2 was not redundantly probed.
- Only the installed Node 22.15.0 and 24.22.1 binaries were executed. Later Node 22 release behavior is inferred from the official backport and release history, not locally executed.
- The standalone server is intentionally used as the authoritative stream-scope reproduction because Achieve's prompt response can race fragmented delivery and close the stream first.
- V3-9113-007 and V3-9113-019 are broad records. A single valid counterexample establishes nonconformance, but passing focused cases on Node 24 does not establish their entire scope.

## Validation and cleanup

All probes had bounded timeouts and completed. Contiguous and deterministic fragmented delivery were compared. The decoded frame type, stream ID, and error code—not exception text—were used for every conclusion. Temporary servers were stopped and temporary probe/output/source files were removed after the report was prepared. No Achieve implementation, test, ledger, prior assessment, or specification page was modified.

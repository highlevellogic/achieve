# If-Range 206 response-metadata decision

## Decision

Implement the minimal correction for `V3-9110-088`: on the successful
`If-Range` path that produces a single-part 206 response, omit
`Content-Type` and `Last-Modified`. Retain the fields required for a valid and
self-describing partial response, including `Date`, `ETag`, `Content-Range`,
the partial `Content-Length`, and `Accept-Ranges`.

This is a SHOULD-level improvement, not a correction to range framing or the
returned bytes. The ordinary 206 path and the full 200 response produced when
`If-Range` is false must remain unchanged.

## Normative analysis

[RFC 9110 Section 15.3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7)
establishes three relevant rules:

1. A 206 response MUST repeat `Date`, `Cache-Control`, `ETag`, `Expires`,
   `Content-Location`, and `Vary` when each field would have appeared in the
   corresponding 200 response.
2. A sender generating 206 in response to a request containing `If-Range`
   SHOULD NOT generate other representation header fields beyond those
   required, because the client already has a prior response containing them.
3. Otherwise, a sender MUST generate all representation header fields that
   the corresponding 200 response would have contained.

For a single-part response, [Section
15.3.7.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7.1)
also requires `Content-Range` and content consisting of the selected range.
`Content-Length`, when sent, describes the partial content length. The example
in that subsection contains `Last-Modified` and `Content-Type`, but an example
does not override the explicit `If-Range` recommendation.

The recommendation applies only when an `If-Range` request actually results
in 206. Under [Section
13.1.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.5), a false
condition causes the server to ignore `Range` and send the complete selected
representation. Achieve currently treats date-form conditions
conservatively as false; its affected 206 case is therefore a matching strong
entity tag.

## Current Achieve behavior

The media range path computes and emits the current representation's strong
`ETag` before evaluating `If-Range`. A nonmatching or weak entity tag disables
range processing and produces the normal 200 response. A matching strong tag
continues through the ordinary range-response construction.

That shared construction currently emits the following fields on the tested
matching `If-Range` 206 response:

| Field | Purpose | Assessment on matching `If-Range` 206 |
|---|---|---|
| `Date` | Response origination time | Conditionally mandatory by Section 15.3.7 and retained. |
| `ETag` | Strong validator for the selected representation | Conditionally mandatory because Achieve sends it on the corresponding 200; retained. |
| `Content-Range` | Identifies the selected byte range and complete length | Mandatory for single-part 206; retained. |
| `Content-Length` | Length of the partial response content | Correct partial-content framing; retained. |
| `Accept-Ranges` | Advertises byte-range support | Not representation metadata and useful protocol metadata; retained. |
| `Server` | Identifies the server product | Not representation metadata; unaffected. |
| `Content-Type` | Media type of the selected representation | Representation metadata already available in the client's prior response; omit on this path. |
| `Last-Modified` | Date validator for the selected representation | Representation metadata already available in the client's prior response; omit on this path. |

Batch B observed the same relevant field set over HTTP/1.1 and h2c. The source
shows that the result is not transport-specific: both transports use the same
range-header construction. No corresponding 200 in the evidence contained
`Cache-Control`, `Expires`, `Content-Location`, or `Vary`; if Achieve later
adds any of those fields to the 200 response, Section 15.3.7 requires the 206
path to retain them.

## Validator, caching, and interoperability effects

Omitting `Last-Modified` does not affect evaluation of the current request:
the successful strong `If-Range` comparison has already occurred. It also
does not remove the current strong validator because `ETag` remains in the
206 response. A client making this request necessarily has a prior response;
the RFC's recommendation is specifically intended to avoid repeating its
representation metadata.

RFC 9110 permits combining partial responses that share a strong validator,
and [RFC 9111 Section
3.4](https://www.rfc-editor.org/rfc/rfc9111.html#section-3.4) likewise bases
cache combination on a shared strong validator. Retaining the current strong
`ETag` therefore preserves the important cache-integrity condition. Omitting
the redundant `Last-Modified` does not impair later entity-tag validation.

`Content-Type` is useful in an ordinary 206 and Section 15.3.7 tells clients
to inspect it along with `Content-Range`. In the narrower matching
`If-Range` case, however, the client already has the prior response and the
explicit SHOULD NOT addresses this exact repetition. Achieve supports only a
single-part range response here, so no multipart media type or boundary is
needed. Keeping `Content-Range` makes the returned part unambiguous.

The practical interoperability risk from omitting these two fields is low for
a conforming `If-Range` client. A client that discarded all metadata from its
prior response while retaining its validator would lose convenient copies of
the media type and modification date, but that is the tradeoff selected by
the RFC recommendation. Ordinary range clients continue to receive both
fields.

## Narrow implementation boundary

The smallest change is in the existing media range-response path after all of
these facts are known:

- the request is GET with both `Range` and `If-Range`;
- the `If-Range` value strongly matches the current `ETag`; and
- the parsed range is satisfiable and will produce 206.

At that point, omit `Content-Type` from the response-header object and skip
the existing `Last-Modified` assignment. Do not change entity-tag evaluation,
range parsing, file opening, streaming, content length, or ordinary 206/200
header selection. This requires no extra I/O and no new metadata computation.

An alternative that removes only `Last-Modified` but retains `Content-Type`
would reduce redundant metadata and might be defensible on interoperability
grounds. It would nevertheless remain a deliberate departure from the
literal recommendation as currently assessed. There is no demonstrated need
for that departure in Achieve's single-part matching-`If-Range` model.

## Is retaining the current behavior defensible?

RFC requirement language permits departure from a SHOULD NOT when the
implementation understands the consequences and has a valid reason. Sharing
one header-building path is an implementation convenience, not a protocol or
interoperability reason. The current code and documentation record no reason
for repeating `Last-Modified` or `Content-Type`.

Retaining `Content-Type` could be justified as defensive accommodation for
clients that process a 206 without consulting their prior response, but that
case conflicts with the premise of a successful `If-Range` request and is not
supported by repository evidence. There is no similarly persuasive reason to
repeat `Last-Modified` while a strong `ETag` is present. On present evidence,
retaining both fields is not the preferable policy.

## Regression-test recommendations

Focused tests should cover all four supported transports (HTTP, HTTPS, h2c,
and secure HTTP/2) and establish:

1. a matching strong `If-Range` produces 206, the requested bytes, current
   `ETag`, `Date`, `Content-Range`, correct partial `Content-Length`, and
   `Accept-Ranges`, but no `Content-Type` or `Last-Modified`;
2. an ordinary range request without `If-Range` still produces 206 with the
   representation's `Content-Type` and `Last-Modified`;
3. stale and weak entity tags, invalid values, and date-form values continue
   to ignore `Range` and return the full 200 response with normal metadata;
4. an unsatisfiable range and existing range-error behavior remain unchanged;
5. a subsequent request on the same HTTP/1.1 connection or HTTP/2 session
   succeeds; and
6. the response bytes and validator remain representation-correct for the
   identity form exercised by the media range path.

The tests should assert exact presence or absence of the affected headers,
not merely the status and content length. Existing conditional and byte-range
tests provide suitable fixtures but currently do not enforce the matching
`If-Range` field policy.

## Conclusion

The matching strong-entity-tag path is a demonstrated, bounded departure from
an RFC 9110 SHOULD NOT recommendation. It is not a mandatory framing defect,
and current responses remain usable. The cleanest decision is nevertheless to
implement the localized omission of `Content-Type` and `Last-Modified` for
successful `If-Range` 206 responses. That aligns the response with the
standard's stated optimization, preserves strong validation and partial
content framing, adds no runtime I/O, and leaves all ordinary range and full
representation responses unchanged.

# Batch B evidence review: Achieve/shared HTTP semantics

## Scope and method

This review covers the 13 Batch B records from the V3 plan. It combines an
independent reading of the exact RFC 9110 conditions, source review, existing
tests, and one temporary standalone probe against Achieve 3.0.6 on Node.js
22.15.0. The probe used an isolated application directory and exercised plain
HTTP/1.1 and h2c. It was removed after use; no Achieve source or existing test
was changed.

Application-authored status codes, fields, and trailers are distinguished from
Achieve-generated output. Deliberate misuse of the general Node response API
is evidence about the application boundary, not automatically an Achieve-core
defect.

## Focused probe design

The temporary probe provided:

- two requests with different User-Agent values over one HTTP/1.1 keep-alive
  socket and two requests over one h2c client session;
- buffered POST requests carrying `X-Batch-Trailer: tail-value` as an
  HTTP/1.1 chunk trailer or HTTP/2 trailing HEADERS;
- a servlet that selected 205 and returned `forbidden-body`;
- an intentional application negative control that supplied two values for an
  undefined, non-list response field;
- paired static 200, ordinary 206, matching If-Range 206, and matching
  If-None-Match 304 requests, with wire-visible metadata captured.

Using streaming `text/plain` initially invoked the servlet before request
trailers arrived. That was a harness-path artifact, not a protocol result. The
final trailer observations use buffered JSON so dispatch occurs after the
request and trailers are complete.

## Requirement decisions

| ID | Normative requirement and owner | Evidence and observations | Conclusion |
|---|---|---|---|
| V3-9110-006 | §3.3: a server MUST NOT assume that two requests on a connection share a user agent unless the secured/specific exception holds. Achieve owns request dispatch; Node supplies transport objects. | Achieve creates a fresh request Context and has no transport-derived user identity mechanism. Two HTTP/1.1 requests on one socket reported distinct requests and their respective `agent-a`/`agent-b` values. Two h2c streams on one client session likewise reported distinct request values. Node exposed different compatibility `req.socket` wrappers for the h2 streams; that is not evidence of different transport sessions or an identity assumption. | **Conformant.** Source and controls establish independent per-request processing. |
| V3-9110-008 | §5.3: a sender MUST NOT generate repeated field lines unless the field definition permits list recombination. Achieve owns core fields; applications own explicitly supplied fields; Node serializes. | Core paths use replacement/unique field assignment. The sole append is `Vary: Origin`, and Vary permits list recombination. Representative HTTP/1.1 and h2c responses had no duplicate non-list core fields. The negative-control servlet made Node emit two HTTP/1.1 `X-Non-List` lines, proving that applications can violate the rule through the raw response API. | **Conformant for Achieve-generated output.** Application-authored duplicate values remain application responsibility and were not misclassified as a core defect. |
| V3-9110-018 | §6.5.1: a sender MUST NOT generate a trailer field unless it knows the field definition permits trailers. | Achieve core has no `addTrailers` or `sendTrailers` call and generated no response trailers in the observed HTTP/1.1 or h2c responses. Servlets can use Node APIs independently. | **Conformant.** Achieve core generates no trailer fields; servlet authors own any trailers they add. |
| V3-9110-019 | §6.5.1: a recipient MUST NOT merge a trailer into headers unless the definition explicitly permits and safely defines merging. Node parses; Achieve preserves the request object. | In both HTTP/1.1 and h2c, the completed request exposed `x-batch-trailer: tail-value` in `trailers` and `rawTrailers`, while it was absent from `headers`. | **Conformant.** Positive trailer controls directly establish separation on both protocols. |
| V3-9110-020 | §6.5.1: a server SHOULD NOT put information it considers necessary only in trailers. | Achieve core generates no trailers. It therefore places no essential core information there. Application trailer semantics are outside core control. | **Conformant.** The recommendation is satisfied by the absence of core trailers. |
| V3-9110-052 | §11.6.1: every server-generated 401 MUST include at least one applicable `WWW-Authenticate` challenge. | Source review found no Achieve-core path that selects 401 or performs authentication challenges. Servlets directly select application 401 responses and their fields. | **Not applicable to Achieve core.** The conditional duty belongs to a deployed application that chooses 401. |
| V3-9110-086 | §15.3.6: a server MUST NOT generate content in a 205 response. Achieve selects completion behavior; Node serializes. | A servlet selected 205 and returned 14-byte `forbidden-body`. HTTP/1.1 emitted status 205, `Content-Length: 14`, and all 14 octets. h2c emitted 205 but Node suppressed DATA, yielding zero content. | **Nonconformant.** The supported HTTP/1.1 endpoint demonstrably violates the MUST NOT. Correct h2c behavior does not cure that transport-specific failure. |
| V3-9110-087 | §15.3.7: a 206 MUST repeat Date, Cache-Control, ETag, Expires, Content-Location, and Vary when each would have appeared on the corresponding 200. Achieve generates static/media metadata. | Paired 200, ordinary 206, and If-Range 206 responses over HTTP/1.1 and h2c all carried Date and the same ETag. Cache-Control, Expires, Content-Location, and Vary appeared on none of the corresponding responses. | **Conformant.** Every conditionally required field actually present on 200 was retained on 206. |
| V3-9110-088 | §15.3.7: for a 206 response to If-Range, a sender SHOULD NOT repeat representation fields beyond the preceding required set. | Matching strong If-Range produced 206 over both protocols with Date, ETag, Content-Type, and Last-Modified. Content-Type and Last-Modified are representation fields beyond the preceding §15.3.7 required set. The implementation records no If-Range-specific reason for repeating either field. | **Nonconformant (SHOULD-level).** This is a missed recommendation, not a MUST-level framing defect. |
| V3-9110-089 | §15.3.7: otherwise, a 206 MUST contain all representation fields that the corresponding 200 would send. | Ordinary 206 responses on both protocols retained the 200 ETag, Last-Modified, and Content-Type. No Content-Encoding, Content-Location, or Vary was present on either response. | **Conformant.** All corresponding representation fields were retained; Content-Length/Content-Range differ as message/range metadata should. |
| V3-9110-094 | §15.4.5: a 304 MUST generate Content-Location, Date, ETag, Vary, Cache-Control, and Expires when the corresponding 200 would have sent each. | Paired 200/304 responses over both protocols carried Date and the same ETag. The other listed fields were absent from both. Each 304 had zero content. | **Conformant.** Every conditionally mandatory field was present. |
| V3-9110-095 | §15.4.5: a 304 sender SHOULD NOT add other representation metadata unless it guides cache updates. | The 304 responses carried Last-Modified in addition to Date and ETag, omitted Content-Type, and had no content. Last-Modified is a validator supplied by the corresponding 200 and directly supports cache validation/update; RFC 9110 itself gives Last-Modified as an example of useful extra metadata. | **Conformant.** No unnecessary representation metadata was observed. |
| V3-9110-097 | §15.5.10: a server choosing 409 SHOULD provide enough content to identify the conflict, unless the method/context precludes content. | Source review found no Achieve-core path that selects 409. An existing completion fixture selects 409 only to test application-owned completion semantics. | **Not applicable to Achieve core.** A servlet choosing 409 owns the conflict explanation. |

## Root-cause and boundary findings

The 205 failure has a shared but transport-specific cause. Achieve completion
does not suppress returned content based on status 205. Node.js 22.15.0's
HTTP/1.1 serializer sends it, whereas its HTTP/2 compatibility layer suppresses
it. The requirement-level result remains Nonconformant because one supported
endpoint violates the MUST NOT.

The If-Range finding is Achieve-owned. The same metadata set is used for
ordinary and If-Range 206 responses, so Last-Modified is repeated even though
§15.3.7 recommends against additional representation metadata in that
conditional case. Content-Type is also repeated; §15.3.7.1 does not expressly
require it for a single-part 206 response.

The intentional duplicate-field negative control is not a finding against
Achieve core. It demonstrates that Node exposes a general serializer and that
servlet applications must obey field definitions when supplying values.

## Count reconciliation

| RFC | Conformant | Nonconformant | Unverified | Not applicable | Optional not implemented | Total |
|---|---:|---:|---:|---:|---:|---:|
| RFC 9110 | 77 | 2 | 11 | 7 | 3 | 100 |
| RFC 9111 | 0 | 0 | 0 | 3 | 4 | 7 |
| RFC 9112 | 25 | 1 | 7 | 7 | 1 | 41 |
| RFC 9113 | 28 | 5 | 24 | 3 | 0 | 60 |
| **Overall** | **130** | **8** | **42** | **20** | **8** | **208** |

Before Batch B, totals were 121 Conformant, 6 Nonconformant, 55 Unverified,
18 Not applicable, and 8 Optional not implemented. Batch B changes are +9
Conformant, +2 Nonconformant, -13 Unverified, and +2 Not applicable.

## Cleanup and limitations

The temporary application and probe runner were removed. All child servers
were closed. No HTTPS or secure HTTP/2 probe was needed to establish either
nonconformity: the HTTP/1.1 205 failure is already dispositive, and the same
If-Range metadata behavior was observed in HTTP/1.1 and h2c. TLS does not alter
the semantic field-generation paths under review.

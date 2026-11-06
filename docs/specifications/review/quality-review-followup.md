# Focused Follow-up to the Consolidated HTTP Conformance Quality Review

## Scope and baseline

This follow-up addresses only the four issues identified in
`consolidated-quality-review.md`. It reviews the relevant V3 rows, V2 mapping,
existing evidence, and the normative text of RFC 9110, RFC 9112, and RFC 9113.
One bounded HTTP/2 reproduction was run for the 405 `Allow` question; no other
new protocol probe was performed.

The V3 ledger and mapping remain unchanged at 208 records:
152 Conformant, 14 Nonconformant, 11 Unverified, 22 Not applicable, and
9 Optional not implemented. Every change below is a proposal requiring review.

## 1. Missing RFC 9113 section 9.2.2 TLS requirement

### Normative requirement

[RFC 9113 section 9.2.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2.2)
contains a mandatory interoperability floor distinct from its prohibited-suite
recommendation:

- A TLS 1.2 deployment **MUST** support
  `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` with the P-256 elliptic curve.

This is separate from:

- `V3-9113-056`, the **SHOULD NOT** recommendation against suites listed as
  prohibited by HTTP/2; and
- `V3-9113-057`, the **MAY** permission to use `INADEQUATE_SECURITY` after
  detecting a prohibited suite.

No existing V3 row states the mandatory cipher-and-curve support obligation.
`V3-9113-051` concerns minimum TLS version, `054` ALPN support, and `055` ALPN
selection; none subsumes it.

### Proposed record

| Field | Proposed value |
|---|---|
| ID | `V3-9113-061` |
| RFC/section | RFC 9113 §9.2.2 |
| Normative level | MUST |
| Requirement | A TLS 1.2 HTTP/2 deployment MUST support `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256` with the P-256 elliptic curve. |
| Conditions | HTTP/2 deployment supports TLS 1.2. |
| Role | HTTP/2 TLS endpoint/deployment |
| Responsibility | OpenSSL/Node TLS configuration exposed by Achieve secure HTTP/2 options |
| Initial classification | **Unverified** |
| V2 traceability | Newly discovered during V3 quality review; no V2 source row covers it. |

Batch F established that the required cipher suite can negotiate TLS 1.2 and
ALPN `h2`, but did not record the selected ephemeral curve. Cipher success
alone does not prove P-256 support. A later focused TLS control should capture
both the standard cipher name and ephemeral key/curve information before this
record is classified Conformant.

Adding the row would increase the inventory to 209 unless another approved
inventory correction changes the accounting. It should not be inserted
silently merely to preserve the old total.

## 2. `V3-9110-098`: 405 and Allow

### Normative requirement

[RFC 9110 section 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6)
states that a server generating a 405 response **MUST** generate an `Allow`
field containing the target resource's currently supported methods.

The obligation is triggered by generation of 405; it is not limited to a 405
selected explicitly by Achieve application code.

### Existing evidence and focused reproduction

`tests/connect/verify.js` already establishes that a classic HTTP/2 CONNECT
request receives 405, but records only status and body. The follow-up therefore
ran one bounded reproduction against:

1. a standalone Node.js HTTP/2 compatibility server; and
2. Achieve 3.0.6 `listen2()` with a temporary application directory.

Both used Node.js 22.15.0 with nghttp2 1.64.0 and the same valid classic
CONNECT pseudo-fields (`:method CONNECT`, `:authority example.test:443`).

| Endpoint | Handler invoked | Response fields |
|---|---:|---|
| Standalone Node compatibility server | 0 | `:status: 405`, `date`; no `allow` |
| Achieve 3.0.6 | Not dispatched as an Achieve request | `:status: 405`, `date`; no `allow` |

The stream completed normally with an empty body. The result assigns the
behavior to Node's HTTP/2 compatibility layer before the normal request
handler, while still making it observable behavior of the supported Achieve
endpoint.

### Proposed classification change

`V3-9110-098` should change from **Not applicable** to **Nonconformant** for
Achieve 3.0.6 on Node.js 22.15.0. Direct evidence establishes both trigger and
missing mandatory field.

Proposed responsibility: “Node.js HTTP/2 compatibility layer; complete
Achieve endpoint.” An Achieve change might require intercepting HTTP/2 CONNECT
at a lower-level stream interface or an upstream Node correction; normal
compatibility request handling is never invoked. No implementation remedy is
proposed in this documentation task.

If approved without other classification changes, this would change totals to
152 Conformant, 15 Nonconformant, 11 Unverified, 21 Not applicable, and
9 Optional not implemented (208 total).

## 3. Combined and overlapping requirements

### `V3-9112-041`: multiple client rules combined and overstated

[RFC 9112 section 9.8](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.8)
contains distinct client rules after an incomplete TLS close:

1. a client **SHOULD** treat requests as completed when it received the stated
   Content-Length or terminal chunk;
2. an unframed, close-delimited response is complete only after a valid
   closure alert (a normative declarative rule without an explicit BCP 14
   keyword); and
3. a client detecting incomplete close **SHOULD** recover gracefully.

The existing row combines these rules and labels them MUST, even though the
section does not state the recorded client MUST NOT. Server-side
closure obligations are already separate in `V3-9112-039` and `040`.

Smallest proposed correction:

- retain `V3-9112-041` for the explicit client **SHOULD** concerning framed
  completion and graceful recovery, still Not applicable to Achieve's
  origin-server role;
- add `V3-9112-042` for the declarative rule that an unframed close-delimited
  response is complete only after a valid closure alert, with no fabricated
  BCP 14 level, also Not applicable; and
- change mapping row `V2-X043` from a one-target correction to a split mapping
  to `V3-9112-041;V3-9112-042`.

This preserves the existing identifier and V2 source while separating levels.
It would add one inventory record.

### `V3-9113-007`: umbrella stream-state record

Section 5.1 defines a state machine whose individual frame/state obligations
also appear in more specific V3 rows. `V3-9113-007` overlaps at least `008`,
`009`, `012`, `015`, `020`, `022`, `023`, and `026`. The Nonconformant result
is logically justified because a single applicable counterexample disproves
the umbrella MUST, but counting the umbrella alongside specific failures
duplicates requirement-level impact.

Smallest proposed correction: retain the ID, mapping, and Nonconformant result,
but mark it explicitly as a **composite summary record** and exclude it from
claims that counts represent independent normative obligations. Do not split
or delete it until the inventory adopts a formal policy for composite rows.

### `V3-9113-014`: broad but not combined

Section 5.4.1 has one recommendation: when possible, an endpoint detecting a
connection error **SHOULD** send GOAWAY with the applicable error code before
closing. The row does not combine distinct normative levels, but quantifies
over many connection-error families. Existing evidence covers many families
and found no silent-close counterexample, yet cannot establish “when possible”
universally.

Smallest correction: retain the row and Unverified classification. Narrow its
rationale to list the tested error families and state that untested families
remain outside the evidence. Splitting by every error source would duplicate
the more specific error-code records without improving traceability.

### `V3-9113-031`: mandatory rule plus optional response permission

Section 8.1.1 requires a detected malformed request to be treated as stream
`PROTOCOL_ERROR`; it also permits a server to send an HTTP response before
closing/resetting the stream. The MAY permission is not part of the mandatory
conformance result.

Smallest correction: retain `V3-9113-031`, but rewrite its requirement field
to contain only the MUST-level stream-error obligation. Move the MAY response
permission to conditions/rationale. Retain Unverified because the row still
quantifies over all detected malformed-request families. No new ID or mapping
change is needed.

### `V3-9113-053`: two TLS renegotiation obligations

[RFC 9113 section 9.2.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2.1)
requires TLS 1.2 renegotiation to be disabled and separately requires an
attempt after the client connection preface to be treated as connection
`PROTOCOL_ERROR`. The existing row now accurately records only the latter,
which Batch F found Nonconformant.

Smallest proposed correction:

- retain `V3-9113-053` unchanged for post-preface error handling;
- add `V3-9113-062` for “A TLS 1.2 HTTP/2 implementation MUST disable TLS
  renegotiation,” initially **Unverified**; and
- split V2 mapping `V2-NEW-075` to `V3-9113-053;V3-9113-062`.

The existing probe showed no completed renegotiation, but one failed attempt
does not establish the deployment-wide disablement requirement. The narrow
pre-preface client-certificate exception belongs in `053`'s conditions and
does not remove the general disablement requirement.

## 4. Evidence-overstatement review

### `V3-9112-001` — HTTP/1.1 generated-message grammar

Evidence covers representative 200, 404, parser-error, CONNECT, HTTP/1.0,
Content-Length, and chunked outputs, plus Node rejection of invalid fields.
It does not enumerate every HTTP-message grammar production or every
application-controlled value.

Recommendation: retain Conformant only with a narrowed scope: Achieve core and
supported Node response APIs on Node 22.15.0. Change the rationale from a
universal grammar conclusion to centralized-serializer evidence plus tested
core templates. Arbitrary direct socket output remains application-owned.
No additional finite test can prove every grammar production.

### `V3-9112-002` — octet-oriented parsing

Batch D directly demonstrated one-octet-to-one-code-unit preservation for
selected high-bit field-value octets and rejection in a field name. Combined
with Node's native parser boundary, this strongly supports octet-oriented
parsing, but is version-specific and does not prove every request component.

Recommendation: retain Conformant, narrow the rationale to the tested parser
and components, and keep the Node 22.15.0 limitation. More sample octets would
increase breadth but not provide universal proof.

### `V3-9113-003` — reserved frame-header bit

P01 directly verifies receiver ignoring. Sender capture covers SETTINGS,
SETTINGS ACK, HEADERS, RST_STREAM, and GOAWAY, with other campaigns observing
DATA and WINDOW_UPDATE. It does not capture every frame type or every output
path.

Recommendation: retain Conformant because Node/nghttp2 centralizes frame
header serialization, but explicitly say “all observed sender frame types”
rather than implying exhaustive output coverage. No classification change is
warranted absent a counterexample.

### `V3-9113-059` — incorrect section 10.5.1 obligation

Section 10.5.1 does not state the ledger's claimed MUST to impose a field-
section size limit. It explains that limits can be advertised or enforced,
then requires a received field block to be processed sufficiently to preserve
consistent connection state unless the connection is closed.

Recommendation: retain the ID and V2 traceability, correct the requirement to
“A received field block MUST be processed to ensure a consistent connection
state unless the connection is closed,” and classify it **Unverified** pending
direct evidence. A raw oversized HPACK block followed by a valid connection
control could establish whether Node closes or processes the block without
desynchronizing compression state. Node's finite pair/memory limits remain
useful security evidence but do not prove this actual MUST.

### `V3-9113-060` — tracking and limiting exposed work/resources

Node documentation identifies finite defaults for session memory, field
pairs, SETTINGS entries, invalid frames, rejected streams, and outstanding
operations. That supports the section 10.5.2 SHOULD-level recommendation.
However, the Batch F 10-ping observation was primarily the Node client-side
outstanding-ping limit; it does not prove the server bounds inbound PING abuse.
The 200-request health control demonstrates recovery only for that bounded
workload.

Recommendation: retain Conformant based on documented server-side defaults,
but remove the client-ping result as affirmative server evidence. State
explicitly that the classification does not establish universal DoS
resistance. A future inbound raw control-frame stress test could improve
evidence but is not needed to interpret the SHOULD narrowly.

## Proposed changes requiring approval

| Proposal | Classification/count effect |
|---|---|
| Add `V3-9113-061` for mandatory TLS 1.2 cipher plus P-256 support, initially Unverified. | Adds one record and one Unverified. |
| Reclassify `V3-9110-098` Not applicable → Nonconformant. | Same 208 records; NC +1, NA -1. |
| Split `V3-9112-041` by adding `V3-9112-042`. | Adds one Not applicable record. |
| Mark `V3-9113-007` explicitly composite; do not renumber/delete it. | No classification change; counting-policy clarification. |
| Narrow `V3-9113-031` to its MUST clause. | No classification change. |
| Add `V3-9113-062` for TLS 1.2 renegotiation disablement, initially Unverified. | Adds one record and one Unverified. |
| Narrow evidence/rationale for `V3-9112-001`, `002`, and `V3-9113-003`, `060`. | No classification change. |
| Correct `V3-9113-059` to §10.5.1's actual state-consistency MUST and classify it Unverified pending direct evidence. | Same record count; C -1, U +1. |

Applying every proposed structural addition would produce 211 records before
classification changes. The inventory policy and mapping should therefore be
approved before editing the ledger or recalculating totals.

## Boundary accuracy note

The exact-text review also exposed an error in the preceding consolidated
review's clerical treatment of `V3-9110-088`. RFC 9110 §15.3.7.1 requires
`Content-Range` and the selected range content for a single-part 206; it does
not separately make `Content-Type` mandatory there. Section 15.3.7's If-Range
SHOULD NOT therefore can apply to both repeated `Content-Type` and
`Last-Modified` when they are not otherwise required. The earlier clerical
change that narrowed the evidence to Last-Modified should be reversed after
approval. This follow-up does not alter that row or any existing assessment
file because the issue falls outside the four authorized edits and existing
assessment changes are prohibited.

## Validation and cleanup

- No V3 ledger, V2-to-V3 mapping, consolidation, or summary file was modified.
- No Achieve implementation, existing test, or public HTML page was modified.
- The temporary 405 reproduction script and application directory were
  removed, and both temporary servers were closed.
- No upstream issue was filed.

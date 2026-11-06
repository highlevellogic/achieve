# Normative Requirements Audit of the Achieve 3.0.6 HTTP Ledger

## 1. Executive assessment

The existing 116-entry ledger cannot presently support an exhaustive HTTP conformance claim. All 116 records were examined against the official RFC Editor text of RFC 9110, RFC 9111, RFC 9112, and RFC 9113. The CSV is structurally valid, but its normative inventory is not yet reliable enough for scoring.

The principal problems are:

- descriptive or definitional RFC prose has sometimes been converted into invented MUST or SHOULD requirements;
- broad summaries combine several independent obligations, sometimes at different requirement levels;
- some obligations are assigned to Achieve even though they belong to Node's protocol implementation or to application-authored servlet responses;
- several citations point to the wrong subsection or protocol specification;
- many applicable origin-server and protocol-endpoint obligations are absent.

This audit recommends retaining 31 entries substantially as written, revising 44, splitting 30, and removing or replacing 11. It identifies 76 concrete missing obligations or missing subdivisions. That count is conservative: several broad frame-processing and cache rows will yield more than two records when fully decomposed.

No conformance status was changed by this audit. The findings concern the fidelity and completeness of the requirements inventory, not whether Achieve passes or fails a corrected requirement.

## 2. Method and counts

The official XML editions were screened systematically. Paragraphs containing BCP 14 keywords were extracted and then reviewed by role and capability; grammar-based obligations and conditions spanning adjacent paragraphs were also considered. The source inventory contained 310 normative paragraphs in RFC 9110, 70 in RFC 9111, 94 in RFC 9112, and 184 in RFC 9113. Keyword counts are not requirement counts: one paragraph can contain several obligations, and grammar can be normative through RFC 9110 Section 2.2 without repeating a keyword.

| Audit disposition | Existing entries |
|---|---:|
| Retain substantially as stated | 31 |
| Revise citation, wording, level, applicability, or responsibility | 44 |
| Split into independently assessable obligations | 30 |
| Remove or replace because the claimed obligation is unsupported or inapplicable | 11 |
| **Total examined** | **116** |

The 31 entries that can be retained substantially as written are: `S012`, `S022`, `S024`, `S027`, `S028`, `S031`, `S032`, `S039`–`S043`, `S047`, `S048`, `S051`–`S055`, `S058`, `S060`–`S063`, `S065`, `H105`, `H106`, `H119`, `H202`, `H211`, and `H223`. Minor editorial tightening might still be useful, but their normative basis, level, and basic scope are supportable.

## 3. Incorrect normative references or unsupported requirements

### Entries to remove or replace

| ID | Problem | Required action |
|---|---|---|
| S002 | RFC 9110 §5.2 does not say a proxy MUST NOT generate fields it does not understand. The relevant rule is that a proxy forwards unrecognized fields subject to Connection/configuration exceptions. | Remove; add the actual proxy rule only if a proxy role is in scope. |
| S006 | RFC 9110 §6.3 describes message components; it does not state the ledger's generic MUST for protocol framing. Framing duties belong in RFC 9112/9113 records. | Remove and rely on decomposed protocol-specific framing entries. |
| S010 | RFC 9110 §§8.1–8.2 describe representation data and metadata without the recorded generic MUST. | Remove; use field-specific Content-Type, Content-Encoding, Content-Length, validator, and HEAD obligations. |
| S013 | The coded representation model in §8.4.1 is definitional, not the recorded independent MUST. The actual sender MUST is to list applied codings in Content-Encoding. | Remove; S012 covers the explicit obligation. |
| S018 | RFC 9110 §8.8.1 says a strong validator *might* change for metadata and permits identical strong validators where representation data is identical. It contains no recorded SHOULD. | Remove or replace with an accurately scoped definition-based record. |
| S025 | RFC 9110 §9.2.2 constrains clients automatically retrying non-idempotent requests. It does not create the stated independent server-as-client SHOULD NOT. | Remove. |
| S029 | RFC 9110 §9.3.3 defines POST semantics but does not state the broad SHOULD recorded here. | Remove; assess concrete method/status requirements where applicable. |
| S035 | RFC 9110 §8.7/§10.2.2 defines Content-Location semantics; it does not say an origin server SHOULD send it only under the ledger's formulation. | Remove or replace with syntax/semantic obligations if Achieve generates the field. |
| C004 | RFC 9111 explains response cache directives but does not contain the generic origin-server MAY recorded here. | Remove; inventory the specific directives Achieve actually generates. |
| C005 | RFC 9111 §5.2.2.2 defines cache behavior for must-revalidate; it does not say the sender MUST NOT use it to imply unrelated behavior. | Remove; cache-recipient duties are not Achieve origin-server duties. |
| C007 | RFC 9111 §7.1 concerns cache invalidation after unsafe methods, not the stated prohibition on using a request as another response. | Remove and add the actual cache-only invalidation duties only if an HTTP cache role enters scope. |

### Entries requiring corrected references or normative basis

| ID | Discrepancy |
|---|---|
| S001 | §5.1 defines field names and says non-proxy recipients SHOULD ignore unrecognized fields. It does not contain “MUST parse a received field line according to the field's syntax.” Replace with the actual §5.1, §5.5, and field-specific rules. |
| S003 | §5.3 permits combination only without semantic change, preserving order and respecting list syntax. The current wording omits material conditions. |
| S004 | §5.5 places the explicit MUST on a **recipient** to reject CR/LF/NUL or replace each with SP. Sender grammar conformance follows separately from §2.2. The subject and level basis are wrong. |
| S005 | §6.2 discusses message control/data structure and response sequencing; the ledger collapses several protocol- and error-dependent completion cases into a universal statement. Narrow and cite the actual final-response rule plus RFC 9112/9113 closure exceptions. |
| S008 | Absolute-form processing is chiefly RFC 9112 §3.2.2 with target-resource semantics in RFC 9110 §7.1; §7.2 alone does not support the complete statement. |
| S009 | The HTTP/2 prohibition on connection-specific fields is RFC 9113 §8.2.2. RFC 9110 §7.6.1 describes Connection semantics and notes version restrictions. |
| S011 | §8.3 says a sender with content SHOULD generate Content-Type unless the media type is unknown. “Reflecting the enclosed representation” omits this exception and is not the exact obligation. |
| S015 | §8.6 says the server **MUST NOT** send Content-Length on HEAD unless it equals the corresponding GET length. The row is labeled MUST rather than MUST NOT. |
| S016 | The same level error applies to Content-Length on 304: it is a conditional MUST NOT. |
| S017 | Strong-validator behavior is a normative definition in §8.8.1, not an explicit BCP 14 MUST. Record “definitional requirement via strong-validator semantics,” then separately apply §8.8.3's explicit weak-marking MUST. |
| S019 | The Last-Modified SHOULD is in §8.8.2.1, not merely §8.8.2, and is conditional on the date being reasonably and consistently determinable. |
| S021 | Quoted entity-tag syntax is grammar in §8.8.3, made sender-normative by §2.2. It is not a standalone explicit MUST in §8.8.3. |
| S023 | Coding distinction follows the strong-validator definition and §8.8.3.3 example; §8.8.3.3 does not state the recorded standalone MUST. |
| S026 | The general-purpose server requirement to support GET and HEAD is in §9.1. The current §9.3.1 citation and retrieval condition are inaccurate. |
| S030 | CONNECT request-target form is specified by RFC 9112 §3.2.3 and RFC 9110 §9.3.6. Preserve the precise invalid/empty-port conditions rather than the broad paraphrase. |
| S033 | §10.1.1 contains a MAY for 417 on unsupported expectations and separate MUST/MUST NOT rules for 100-continue. The current generic server MAY does not represent them. |
| S036 | WWW-Authenticate is §11.6.1; §11.6.2 is Authorization. Correct the citation and preserve the condition “each 401 response generated.” |
| S037 | Vary is §12.5.5, not §12.5.3. Its SHOULD is conditional on a cacheable response intended for selective reuse. |
| S038 | The current prohibition is not the actual Vary MUST NOT. The explicit rule is that a proxy MUST NOT generate `Vary: *`; listed fields otherwise describe cache-key matching semantics. |
| S049 | The date algorithm is required as part of the §13.1.5 MUST evaluation, but its numbered steps do not independently use MUST. Record the inherited normative basis and the §8.8.2.2 strength prerequisite. |
| S064 | §15.5.10 uses SHOULD for response content sufficient to recognize the conflict source; the current abbreviated wording loses that condition. |
| S066 | §14.6 defines multipart/byteranges. It does not state the generic MAY recorded here; optional selection of one or more ranges arises from §14.2/§15.3.7. |
| C003 | RFC 9111 has no generic MUST that every Cache-Control sender follow an unspecified directive syntax. It has specific sender rules, such as unquoted max-age/s-maxage and quoted no-cache/private field lists. Replace with those. |
| C006 | §5.4 says Pragma is not a reliable replacement for Cache-Control and defines compatibility behavior; the current MUST is invented. |
| H101 | RFC 9112 §2.2 has specific version and message-generation requirements. “Version matching syntax” is too broad and needs the exact sender conditions. |
| H102 | Octet-sequence parsing is in RFC 9112 §2.2, not §2.3. Preserve the recipient/parser responsibility. |
| H104 | Request-line syntax is grammar plus general sender/recipient parsing rules; §3 does not state this standalone server MUST. |
| H107 | §3.2.1 primarily requires clients to generate origin-form in the stated circumstances. It does not state the unconditional origin-server acceptance MUST recorded here. |
| H108 | §3.2.2 separately constrains proxies generating absolute-form and origin servers accepting it. Preserve role and proxy-request conditions. |
| H109 | §3.2.3 requires a client to generate authority-form only for CONNECT; server validation belongs in separate target/error rules. |
| H110 | §3.2.4 constrains client generation of asterisk-form and server handling of `OPTIONS *`; the current acceptance formulation obscures those roles. |
| H112 | RFC 9112 §6.1 says a recipient of HTTP/1.0 with Transfer-Encoding treats framing as faulty and closes; it also restricts server generation based on request version. The current sender-only statement is wrong. |
| H115 | Zero body length for a request lacking Transfer-Encoding and Content-Length is step 7 of §6.3's algorithm, not the broad independent MUST stated. |
| H116 | Chunk grammar and completion follow §7.1 plus §2.2 grammar conformance; distinguish sender generation from recipient decoding. |
| H117 | §7.1.1 requires recipients to ignore unrecognized chunk extensions and recommends limits. Preserve the exact recipient condition rather than “parse safely.” |
| H118 | Trailer restrictions are defined in RFC 9110 §6.5.1 and RFC 9112 §7.1.2. Replace “overriding” with the explicit prohibited-field and merge rules. |
| H201 | RFC 9113 §4 contains many independent frame obligations; “correctly parse and enforce rules” is an umbrella description, not one MUST. |
| H205 | GOAWAY restrictions distinguish sender, receiver, stream identifier, and retry behavior. “Server rejects new streams exceeding last processed” is not the precise §5.1.1 requirement. |
| H207 | §5.4.1 specifies when an endpoint **SHOULD** send GOAWAY, what error code it uses, and closure behavior. The broad MUST and “where possible” need decomposition. |
| H208 | §5.4.2 defines RST_STREAM signaling and conditions; the current statement loses exceptions for already-closed streams and connection errors. |
| H209 | A server receiving PUSH_PROMISE is a connection error because servers cannot be pushed to. State that precise rule and responsibility. |
| H215 | RFC 9113 differentiates malformed requests (stream error or HTTP response), malformed responses (stream error), and connection errors. The combined statement is inaccurate. |
| H216 | §8.2.2 makes prohibited connection-specific fields a malformed-message condition; it does not generally require a sender to “split or remove” fields. |
| H217 | `TE` values other than `trailers` make the field block malformed. Record the grammar/malformed-message basis rather than an unsupported generic MUST. |

## 4. Combined or overly broad entries requiring splitting

Each row below contains at least two independently assessable obligations or mixes requirement levels.

| ID | Required decomposition |
|---|---|
| S007 | Separate missing Host, multiple Host, invalid Host, and authority/Host conflict cases; cite RFC 9112 §5 and RFC 9113 authority rules by protocol. |
| S014 | Split the four Content-Length prohibitions/conditions: HEAD, 304, 1xx/204, and successful CONNECT. |
| S020 | Split “MUST NOT generate future Last-Modified” from “MUST replace future metadata time with Date.” |
| S034 | Split Date generation for 2xx/3xx/4xx (MUST), optional 1xx/5xx generation (MAY), and no-clock prohibition (MUST NOT). |
| S044 | Split invalid date, multiple-member value, non-GET/HEAD method, and missing modification date ignore rules. |
| S045 | Split the SHOULD to evaluate, SHOULD NOT perform, and SHOULD generate 304 obligations. |
| S046 | Split precedence over If-Unmodified-Since, invalid/list date, and unavailable modification date. |
| S050 | Split the false-condition MUST ignore Range from the true-condition SHOULD process Range. |
| S056 | Split satisfiable-range SHOULD 206 from unsatisfiable-range SHOULD 416. |
| S057 | Split malformed range handling from excessive/abusive range-set handling and preserve their different conditions. |
| S059 | Split single-part Content-Range generation, selected byte boundaries, payload length, and other 206 metadata duties. |
| C001 | RFC 9111 §3 has a multi-condition cache-storage gate. Each role, method, status, no-store/private/Authorization, and understood-directive condition needs a separate cache-only record. |
| C002 | RFC 9111 §4 has separate cache-key, method, target URI, Vary, freshness, validation, and directive requirements. |
| H103 | Separate leading empty lines, whitespace between start-line and fields, request rejection/consumption, and proxy response handling. |
| H111 | Separate missing Host, duplicate Host, invalid Host, and absolute-form reconstruction rules. |
| H113 | Decompose all ordered message-body-length cases in §6.3, including HEAD/1xx/204/304, CONNECT, Transfer-Encoding, Content-Length, zero-length requests, and close-delimited responses. |
| H114 | Correctly separate TE+CL handling (reject or use TE, but MUST close) from invalid/conflicting Content-Length (400 and close). The current “MUST reject TE+CL” is wrong. |
| H120 | Split SHOULD send `Connection: close`, MUST close after response, and MUST NOT process further requests. |
| H203 | Split contiguous HPACK decoding, compression-state maintenance, field-block limits, and COMPRESSION_ERROR handling. |
| H204 | Split each stream-state transition and its stream/connection error consequences. |
| H206 | Split advertised concurrency enforcement, REFUSED_STREAM handling, and counting rules. |
| H210 | Split SETTINGS acknowledgement, ACK payload prohibition, each defined setting's range, and application timing. |
| H212 | Split connection/stream windows, DATA-only accounting, overflow, WINDOW_UPDATE, and initial-window changes. |
| H213 | Split each required pseudo-header, CONNECT exceptions, authority requirements, path rules, and malformed handling. |
| H214 | Split classic CONNECT's required `:method`/`:authority`, prohibited `:scheme`/`:path`, and extended CONNECT conditions. |
| H218 | Split exactly one `:status`, valid three-digit status, informational responses, and final response requirements. |
| H219 | Split chunked Transfer-Encoding prohibition from Content-Length mismatch handling. |
| H220 | Split TLS version, compression, renegotiation, cipher, and feature restrictions. |
| H221 | Split ALPN support, `h2` selection, and connection establishment behavior. |
| H222 | Replace the broad “mitigate risks” row with concrete field-size, stream, settings, compression-context, and resource-limit requirements from §§10.3–10.5 and their earlier normative definitions. |

## 5. Applicability and responsibility corrections

- RFC 9111's storage, freshness, reuse, Age, Vary matching, validation, and invalidation requirements apply to an HTTP cache. Achieve's compressed-file artifact cache is not an HTTP response cache. `C001` and `C002` therefore describe out-of-scope cache roles unless a separate HTTP cache is introduced.
- Application-authored servlet status codes, Content-Type, Content-Length, validators, and arbitrary fields are application responsibility when the application takes direct response ownership. Core-generated responses remain Achieve responsibility; wire framing and forbidden-protocol-field enforcement are often shared with Node.
- RFC 9112 parser, framing, chunking, persistence, and most connection rules are primarily Node responsibilities. Achieve remains responsible where it consumes or fails to consume request streams, destroys connections, or sets conflicting metadata.
- RFC 9113 frame parsing, HPACK, stream state, flow control, SETTINGS, PING, GOAWAY, and TLS protocol enforcement are primarily Node/OpenSSL responsibilities. Achieve remains responsible for pseudo-field-derived routing, application response semantics, and configuration it passes to Node.
- Client-only entries `S024` and `S032` are accurately recognizable requirements but are Not applicable to Achieve's origin-server role. Keeping them is useful only if the ledger intentionally records material exclusions.
- Proxy-only rules should not appear as applicable obligations. `S002`, parts of `S038`, and several RFC 9111/9112 forwarding rules need removal or explicit Not-applicable treatment.

## 6. Missing applicable requirements

The following 76 obligations are absent or are only hidden inside an overbroad row. “Subdivision” means the normative material is partially represented but needs its own independently assessable record. No implementation conformance is assessed here.

### RFC 9110 — HTTP Semantics

| ID | Section and URL | Requirement | Level/basis | Responsibility | Kind |
|---|---|---|---|---|---|
| NEW-001 | [§2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-2.2) | A sender must not generate protocol elements that violate the corresponding ABNF. | MUST NOT | Shared/Node/Achieve | New |
| NEW-002 | [§2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-2.2) | A sender must not generate syntax allowed only for a role it does not have. | MUST NOT | Shared | New |
| NEW-003 | [§2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-2.3) | Recipients should parse defensively with only marginal assumptions about conformance and size. | SHOULD | Node/shared | New |
| NEW-004 | [§2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-2.3) | A recipient must accept elements at least as long as values it generates for the same elements. | MUST | Node/shared | New |
| NEW-005 | [§2.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-2.4) | A recipient must interpret received elements according to defined semantics absent a justified compatibility workaround. | MUST | Shared | New |
| NEW-006 | [§3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.3) | A server must not assume two requests on one connection are from the same user agent unless the connection is secured and specific to it. | MUST NOT | Achieve/application | New |
| NEW-007 | [§5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1) | A non-proxy recipient should ignore unrecognized header and trailer fields unless another rule applies. | SHOULD | Shared/application | Replacement for S001 |
| NEW-008 | [§5.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3) | A sender must not generate duplicate field lines unless the field permits list recombination. | MUST NOT | Shared/application | New |
| NEW-009 | [§5.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.3) | A server must not apply a request before receiving the complete header section. | MUST NOT | Node/shared | New |
| NEW-010 | [§5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.4) | A server declining an oversized request field/section must respond with an appropriate 4xx rather than silently ignore it. | MUST | Node/shared | New |
| NEW-011 | [§5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5) | A field parser must exclude permitted leading/trailing whitespace before evaluating the value. | MUST | Node/shared | New |
| NEW-012 | [§5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.5) | A recipient of CR, LF, or NUL in a field value must reject the message or replace each with SP before further processing. | MUST | Node | Replacement for S004 |
| NEW-013 | [§5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) | A timestamp parser must accept IMF-fixdate and both obsolete HTTP-date forms. | MUST | Achieve/Node | New |
| NEW-014 | [§5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) | A sender must generate HTTP-date timestamps in IMF-fixdate form. | MUST | Shared | New |
| NEW-015 | [§5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) | A recipient must interpret an rfc850 two-digit year apparently over 50 years in the future as the most recent matching past year. | MUST | Achieve/Node | New |
| NEW-016 | [§6.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1) | A sender must not generate a trailer unless the field definition permits trailers. | MUST NOT | Shared/application | New |
| NEW-017 | [§6.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1) | A recipient must not merge trailers into headers unless the definition explicitly permits and defines safe merging. | MUST NOT | Node/shared | New |
| NEW-018 | [§6.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.5.1) | A server should not put information essential to the user agent only in trailers. | SHOULD NOT | Achieve/application | New |
| NEW-019 | [§8.8.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.1) | The origin server should obtain Last-Modified as close as possible to Date generation. | SHOULD | Achieve | New |
| NEW-020 | [§8.8.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.1) | A future implementation-derived Last-Modified value must be replaced with message origination Date. | MUST | Achieve | Subdivision of S020 |
| NEW-021 | [§8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3) | An origin server should send ETag where changes can be reasonably and consistently detected. | SHOULD | Achieve | New |
| NEW-022 | [§10.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.1.1) | For a qualifying HTTP/1.1 100-continue request, an origin server must send either 100 Continue or a final response. | MUST | Node/shared | Subdivision of S033 |
| NEW-023 | [§10.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.1.1) | The origin server must not wait for request content before sending the 100 response. | MUST NOT | Node/shared | Subdivision of S033 |
| NEW-024 | [§12.5.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3) | If no acceptable coding is available, the origin server should send identity unless identity is unacceptable. | SHOULD | Achieve | New |
| NEW-025 | [§15.3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7) | A 206 sender must include Date, Cache-Control, ETag, Expires, Content-Location, and Vary when each would appear on the corresponding 200. | MUST | Achieve/shared | New |
| NEW-026 | [§15.3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7) | For 206 responding to If-Range, the sender should not repeat unnecessary representation fields beyond the required set. | SHOULD NOT | Achieve | New |
| NEW-027 | [§15.3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.7) | Otherwise, a 206 sender must include all representation fields that the corresponding 200 would send. | MUST | Achieve | New |
| NEW-028 | [§15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5) | A 304 server must generate the listed cache/validator fields that the corresponding 200 would have sent. | MUST | Achieve | New |
| NEW-029 | [§15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5) | A 304 sender should not emit other representation metadata unless useful for cache updates. | SHOULD NOT | Achieve/application | New |
| NEW-030 | [§15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6) | A server must not generate content in a 205 response. | MUST NOT | Shared/application | New |

### RFC 9111 — HTTP Caching

| ID | Section and URL | Requirement | Level | Responsibility | Kind |
|---|---|---|---|---|---|
| NEW-031 | [§5.2.2.1](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.1) | A sender must not quote a response `max-age` delta-seconds value. | MUST NOT | Achieve/application | Replacement for C003 |
| NEW-032 | [§5.2.2.10](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.10) | A sender must not quote an `s-maxage` delta-seconds value. | MUST NOT | Achieve/application | Replacement for C003 |
| NEW-033 | [§5.2.2.4](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.4) | A sender should not use token form for a qualified `no-cache` field-name list. | SHOULD NOT | Achieve/application | New |
| NEW-034 | [§5.2.2.7](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.7) | A sender should not use token form for a qualified `private` field-name list. | SHOULD NOT | Achieve/application | New |
| NEW-035 | [§5.3](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.3) | An origin server without a clock must not generate Expires except for a fixed past value or one assigned by a clocked system. | MUST NOT | Achieve/application | New |

### RFC 9112 — HTTP/1.1

| ID | Section and URL | Requirement | Level | Responsibility | Kind |
|---|---|---|---|---|---|
| NEW-036 | [§2.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-2.3) | A server receiving whitespace between request-line and first field must reject the request or consume and ignore each whitespace line. | MUST | Node | Subdivision of H103 |
| NEW-037 | [§5](https://www.rfc-editor.org/rfc/rfc9112.html#section-5) | A server must reject whitespace between a field name and colon with 400. | MUST | Node | New |
| NEW-038 | [§5.2](https://www.rfc-editor.org/rfc/rfc9112.html#section-5.2) | A server receiving obsolete line folding must reject with 400 or replace each fold with SP before interpretation/forwarding. | MUST | Node | New |
| NEW-039 | [§6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3) | A server that accepts a request containing both Transfer-Encoding and Content-Length must process Transfer-Encoding alone and close after responding; rejection is also allowed, but closure is mandatory. | MUST | Node | Correction/subdivision of H114 |
| NEW-040 | [§6.1](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.1) | A server receiving an unrecognized request transfer coding should respond 501. | SHOULD | Node | New |
| NEW-041 | [§6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3) | A request whose final transfer coding is not chunked must receive 400 and connection closure. | MUST | Node | Subdivision of H113 |
| NEW-042 | [§6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3) | Invalid or conflicting Content-Length in a request requires 400 and connection closure, except the permitted identical-list normalization. | MUST | Node | Subdivision of H114 |
| NEW-043 | [§6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3) | Premature close/timeout before the declared request length requires treating the message as incomplete and closing. | MUST | Node | New |
| NEW-044 | [§7](https://www.rfc-editor.org/rfc/rfc9112.html#section-7) | If a transfer coding is applied to a request, chunked must be the final coding. | MUST | Node/application | New |
| NEW-045 | [§7](https://www.rfc-editor.org/rfc/rfc9112.html#section-7) | A sender must not apply chunked more than once. | MUST NOT | Node/application | New |
| NEW-046 | [§9.3.2](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.3.2) | A server may parallelize safe pipelined requests but must send responses in request order. | MUST | Node/shared | New |
| NEW-047 | [§9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6) | After receiving or sending `Connection: close`, the server must close at the prescribed point and must not process further requests. | MUST/MUST NOT; split further | Node/shared | Subdivision of H120 |
| NEW-048 | [§9.8](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.8) | TLS endpoints should exchange `close_notify` before closing and must treat premature TLS closure according to message completeness/security rules. | SHOULD/MUST; split further | Node/OpenSSL | New |

### RFC 9113 — HTTP/2

| ID | Section and URL | Requirement | Level | Responsibility | Kind |
|---|---|---|---|---|---|
| NEW-049 | [§3.4](https://www.rfc-editor.org/rfc/rfc9113.html#section-3.4) | The first server frame after the connection preface must be a non-ACK SETTINGS frame. | MUST | Node | New |
| NEW-050 | [§4.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-4.1) | Recipients must ignore the reserved frame-header bit when receiving and leave it unset when sending. | MUST | Node | New |
| NEW-051 | [§4.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-4.1) | Implementations must ignore unknown frame types. | MUST | Node | New |
| NEW-052 | [§5.1.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.1) | Newly established client-initiated streams use odd identifiers; invalid parity is a connection error. | MUST | Node | New |
| NEW-053 | [§5.1.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.1) | New stream identifiers must increase monotonically; reuse or invalid ordering has defined error handling. | MUST | Node | New |
| NEW-054 | [§5.1.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.2) | An endpoint must not exceed the peer's advertised maximum concurrent streams. | MUST | Node | Subdivision of H206 |
| NEW-055 | [§5.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.2) | HTTP/2 flow control applies only to DATA frames and counts padding in the controlled octets. | Normative protocol rule | Node | Subdivision of H212 |
| NEW-056 | [§6.9](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.9) | Flow-control windows must not exceed 2^31−1; overflow is the specified stream or connection error. | MUST | Node | Subdivision of H212 |
| NEW-057 | [§6.5](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.5) | A SETTINGS recipient must acknowledge applied settings. | MUST | Node | Subdivision of H210 |
| NEW-058 | [§6.5](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.5) | A SETTINGS frame with ACK must have an empty payload; otherwise FRAME_SIZE_ERROR. | MUST | Node | Subdivision of H210 |
| NEW-059 | [§6.9.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.9.2) | A SETTINGS_INITIAL_WINDOW_SIZE change must adjust all active stream windows and handle overflow. | MUST | Node | Subdivision of H210/H212 |
| NEW-060 | [§6.7](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.7) | A non-ACK PING requires an ACK response with identical opaque data. | MUST | Node | More precise H211 |
| NEW-061 | [§6.8](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.8) | After GOAWAY, the receiver must not initiate new streams above the last accepted identifier and must apply retry rules. | MUST/MUST NOT; split further | Node | Correction/subdivision of H205/H207 |
| NEW-062 | [§6.9](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.9) | WINDOW_UPDATE with increment zero is a PROTOCOL_ERROR at the applicable scope. | MUST | Node | New |
| NEW-063 | [§8.2.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.2.2) | Connection-specific fields, including Connection, Keep-Alive, Proxy-Connection, Transfer-Encoding, and Upgrade, make an HTTP/2 message malformed. | MUST-level malformed handling | Node/shared | Replacement for H216 |
| NEW-064 | [§8.3](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3) | All pseudo-header fields must precede regular fields; a later pseudo-header makes the message malformed. | MUST | Node | New |
| NEW-065 | [§8.3](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3) | Pseudo-header fields must appear only in their defined message context. | MUST | Node | New |
| NEW-066 | [§8.3](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3) | A message must not contain duplicate pseudo-header fields. | MUST NOT | Node | New |
| NEW-067 | [§8.2.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.2.1) | HTTP/2 field names must be lowercase; uppercase names make the message malformed. | MUST | Node | New |
| NEW-068 | [§8.2.3](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.2.3) | `TE` is permitted only with the value `trailers`; other values make the message malformed. | MUST-level malformed handling | Node | Replacement for H217 |
| NEW-069 | [§8.3.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3.1) | `:path` must not be empty except for the defined `OPTIONS *` case. | MUST | Node/shared | Subdivision of H213 |
| NEW-070 | [§8.1](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.1) | A message whose Content-Length does not equal the sum of DATA payload lengths is malformed. | MUST-level malformed handling | Node/shared | Subdivision of H219 |
| NEW-071 | [§8.3.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3.2) | A response must contain exactly one `:status` value with a valid three-digit status code. | MUST | Node/shared | Subdivision of H218 |
| NEW-072 | [§6.5.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-6.5.2) | A server must not push when the client has disabled push; violation is a connection error. | MUST NOT | Node | New |
| NEW-073 | [§9.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2) | HTTP/2 over TLS must use TLS 1.2 or later, subject to the section's deployment requirements. | MUST | Node/OpenSSL/configuration | Subdivision of H220 |
| NEW-074 | [§9.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2) | TLS compression must be disabled for HTTP/2. | MUST | Node/OpenSSL/configuration | Subdivision of H220 |
| NEW-075 | [§9.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2) | Renegotiation is prohibited except for the narrowly defined client-certificate case. | MUST NOT | Node/OpenSSL/configuration | Subdivision of H220 |
| NEW-076 | [§9.2.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-9.2.2) | A TLS 1.2 HTTP/2 deployment must not negotiate a prohibited cipher suite; the endpoint must terminate with INADEQUATE_SECURITY as specified. | MUST NOT/MUST; split further | Node/OpenSSL/configuration | Subdivision of H220 |

## 7. Coverage by RFC and section

### RFC 9110

All sections were screened for normative language. The ledger has reasonable concentration in validators, preconditions, ranges, and selected statuses, but materially underrepresents general conformance (§2), connection identity (§3.3), field generation/parsing (§5), trailers (§6.5), Date/Last-Modified generation, Expect, Accept-Encoding selection, and required metadata on 206/304 responses. Method-specific requirements for PUT, DELETE, OPTIONS, and TRACE need explicit applicability decisions because Achieve permits registered application handlers even where the core does not implement those methods.

### RFC 9111

All normative paragraphs were screened. Most obligations are cache-only and not applicable because Achieve is an origin server, not an HTTP response cache. The seven current rows overrepresent cache behavior while omitting the few sender-side directive syntax and Expires requirements that can apply to Achieve or applications.

### RFC 9112

All sections were screened. The ledger covers broad request-target and framing themes but does not decompose parser security, obsolete folding, TE/CL closure, incomplete messages, pipelining order, close semantics, and TLS shutdown. Most are Node-owned and should remain in the inventory as applicable-but-delegated requirements.

### RFC 9113

All sections were screened at the normative-paragraph level. The current 23 entries are umbrella summaries of a much larger protocol state machine. Frame format, connection preface, stream identifiers, per-frame constraints, SETTINGS values, flow control, push, pseudo-header ordering, malformed-message rules, GOAWAY behavior, and TLS restrictions need individual records. These are primarily Node/OpenSSL responsibilities, but delegation does not remove them from the applicable inventory.

### Normative dependencies

The following dependencies materially affect supported behavior and should be audited in a separate phase rather than silently folded into these four RFCs:

- RFC 3986 URI syntax and resolution;
- RFC 7541 HPACK;
- RFC 7301 ALPN;
- RFC 8446 TLS 1.3 and RFC 5246 TLS 1.2 where referenced by RFC 9113;
- RFC 2046 media types/multipart syntax;
- RFC 7230-era registered transfer-coding and content-coding dependencies now referenced through the current HTTP specifications;
- RFC 5905 or equivalent clock synchronization as advisory context, not a direct HTTP conformance requirement.

## 8. Recommended ledger correction sequence

1. Remove the 11 unsupported synthetic rows before recalculating any conformance score.
2. Split the 30 compound rows so each record has one responsibility and one requirement level.
3. Correct the 44 citation, wording, level, and role-assignment problems.
4. Add the 76 missing obligations above, splitting mixed-level rows further during insertion.
5. Separate Achieve-core, Node/OpenSSL, application-authored, and not-applicable roles explicitly.
6. Re-run the normative inventory comparison after reconstruction; the corrected ledger will contain substantially more than 181 records because many of the 30 split rows produce multiple replacements.
7. Only then reassess implementation conformance. Existing status totals should not be treated as meaningful until the normative inventory is repaired.

## 9. Unresolved interpretation questions

- Whether registered application methods make every method-specific origin-server obligation part of Achieve's product conformance scope, or whether those obligations should be recorded as application responsibility.
- Whether direct servlet response ownership is part of the Achieve implementation boundary or an explicitly separate application boundary.
- Which TLS configurations Achieve claims to support, since caller-supplied options can affect RFC 9113 conformance.
- Whether Node's compatibility APIs guarantee all RFC 9113 malformed-message outcomes or require native stream-level verification.
- Whether metadata-derived ETags satisfy strong-validator semantics on every supported filesystem and during concurrent in-place mutation; this affects the evidence for S017/S022, not the normative text itself.
- Whether optional TRACE, CONNECT tunneling, server push, and informational response capabilities should be represented as Not applicable, Optional not implemented, or supported through lower-level Node/application APIs.

## 10. Audit conclusion

All 116 existing entries were reviewed, but only 31 can be retained substantially as stated. Eighty-five require revision, splitting, removal, or replacement. At least 76 applicable obligations or necessary subdivisions are missing. No section of the four RFCs was left wholly unscreened, but protocol grammar dependencies and the external RFCs listed above have not yet received the same entry-by-entry decomposition.

The current requirements inventory is therefore insufficient to support a comprehensive HTTP conformance assessment. The first priority is correcting synthetic requirements and mixed-level compound rows; the second is decomposing Node-owned HTTP/1.1 and HTTP/2 protocol obligations; the third is adding the omitted origin-server field, validator, response-metadata, and cache-directive requirements.

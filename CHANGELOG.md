# Changelog

## Achieve 3.1.1

- Revised the README to emphasize ease of use, optional production-oriented
  features, and the published technical specifications and HTTP conformance
  assessment.
- Corrected Windows port allocation in the package smoke-test utility while
  preserving Linux qualification compatibility.

## Achieve 3.1.0

- Corrected HTTP 205 Reset Content responses so application-supplied content
  is suppressed while native Node.js response lifecycle behavior is preserved.
- Omitted unnecessary representation metadata from successful matching
  `If-Range` 206 Partial Content responses.
- Raised the minimum supported runtime to Node.js 24. Node.js 22 is no longer
  supported; Node.js 24.22.2 is the specifically qualified release runtime.
- Improved HTTP/2 conformance by adopting the qualified newer Node.js runtime.

## Achieve 3.0.6

- Strengthened strong ETags with filesystem change and identity metadata already
  available from the opened resource.
- Prevented stale gzip and deflate artifacts from being reused when source
  modification times are preserved.
- Prevented background compression from publishing an artifact when source
  metadata changes during compression.

## Achieve 3.0.5

- Fixed servlet error handling for HEAD requests so error responses do not
  attempt to write a body.
- Improved compatibility with Node.js `rejectNonStandardBodyWrites` handling.
- Added regression coverage for synchronous and asynchronous servlet failures
  across HTTP, HTTPS, h2c, and secure HTTP/2.
- Added the centered README tagline, “Friendly in development. Fast in
  production.”

## Achieve 3.0.0

Achieve 3 modernizes the server for Node.js 22 while retaining its HTTP,
HTTPS, HTTP/2, static-resource, and JavaScript Servlet foundations.

- Added CommonJS and ESM servlet forms through `.jss`, `.jss.cjs`, and
  `.jss.mjs`, unified servlet module loading, managed Promise and `async`
  completion, and the `session.autoEnd` response-ownership API.
- Unified parsed query, form, and JSON input under `session.params`; added
  configurable buffered input and application-managed streaming. Servlet
  completion now preserves application-selected status codes and handles
  empty, null, undefined, Promise, and HEAD results consistently.
- Added validated exact-route and longest-prefix subtree mappings, registered
  handlers for additional HTTP methods, and configurable CORS policies.
- Made the application space explicit through `setAppPath()` and
  `session.appPath`. Strengthened request-path and physical filesystem
  containment for static resources, media, directory defaults, and servlets.
- Improved static-resource handling with representation-specific strong ETags,
  HTTP-date validators, conditional-request precedence, multi-member Range
  request handling, accurate representation lengths, compression negotiation and
  protection of internal compression-cache artifacts.
- Strengthened request validation and failure recovery, including absolute-form
  targets, HTTP/2 authority handling, aborted buffered input, servlet startup
  failures, and response completion before and after headers are sent.
- Separated startup reporting, development diagnostics, persistent server
  logging, and access logging, with improved application-focused servlet error
  diagnostics.
- Raised the minimum Node.js version to 22. The npm package has no runtime
  dependencies and contains only the server, package metadata, README,
  changelog, and license.
- Added complete Getting Started and Reference documentation, prepared a
  separately distributed Advanced Examples project, and added a reproducible
  37-suite verifier with Windows and Linux CI coverage.

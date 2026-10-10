# Changelog

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

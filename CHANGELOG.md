# Changelog

## Achieve 3.0.0 — in development

- Parsed query, form, and JSON request data is provided through
  `session.params`. The compatibility alias `session.parms` remains available.
  Achieve 3 no longer duplicates parsed data on `session.request.get` or
  `session.request.post`.
- POST servlet string responses now use normal UTF-8 handling instead of the
  former POST-only `binary` encoding.

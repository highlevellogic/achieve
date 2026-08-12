# Achieve

Achieve is a lightweight, developer-friendly HTTP server for Node.js with a JavaScript servlet programming model. This repository contains the active Achieve 3.0 development work; version `3.0.0-dev.0` is not yet the stable npm release.

Achieve currently requires Node.js `>= 12.8.1` and has no runtime dependencies.

## Start the development server

From the repository directory:

```text
node start.js
```

The development launcher serves the `tests/` application directory at `http://localhost:8989/`. Windows and Unix-like convenience launchers are also provided as `runw.bat` and `runl.sh`.

An Achieve application directory contains static resources and server-side servlets. The preferred servlet suffix is `.jss`; servlet source is executed on the server and is protected from static delivery. Extensionless requests remain compatible with legacy `.js` servlets, while an explicit request for a `.js` file continues to serve it as static JavaScript.

The current development server handles GET, HEAD, and POST requests. It also includes static compression and caching, audiovisual streaming, and single-byte-range media responses.

See [instructions.txt](instructions.txt) for development and test instructions. The focused, mostly manual regression applications are under [tests/](tests/), with an overview in [tests/README_TESTS.txt](tests/README_TESTS.txt).

For the current stable release and its quick-start guide, see the [Achieve package on npm](https://www.npmjs.com/package/achieve).

# Achieve

Achieve is a lightweight, developer-friendly HTTP server for Node.js with a JavaScript servlet programming model. This repository contains the active Achieve 3.0 development work; version `3.0.0-dev.0` is not yet the stable npm release.

Achieve currently requires Node.js `>= 12.8.1` and has no runtime dependencies.

## Start the development server

From the repository directory:

```text
node start.js
```

The development launcher serves the executable documentation under `examples/` at `http://localhost:8989/`. Windows and Unix-like convenience launchers are also provided as `runw.bat` and `runl.sh`.

An Achieve application directory contains static resources and server-side servlets. The preferred servlet suffix is `.jss`; servlet source is executed on the server and is protected from static delivery. Extensionless requests remain compatible with legacy `.js` servlets, while an explicit request for a `.js` file continues to serve it as static JavaScript.

By default, the path selected with `setAppPath()` contains the root application directly. This keeps small projects and classroom exercises simple; they do not need a `ROOT` directory.

For a production-style application-container layout, call `useRoot(true)` before starting the server:

```text
apps/
    ROOT/
    accounting/
    inventory/
```

`ROOT` is the fixed root application and owns `/`. Sibling application directories own their named URL contexts, such as `/accounting`. A named application takes precedence over a same-named path inside `ROOT`, and a missing resource does not fall back to another application. When `useRoot(true)` is configured, `ROOT` must exist as a directory before the server starts.

Achieve 3.0 replaces the 2.x `setRootDir(...)` API with `useRoot(true)`. Arbitrary root directory names and paths are no longer supported; move the root application to the fixed `ROOT` directory beneath the application path.

The current development server handles GET, HEAD, and POST requests. It also includes static compression and caching, audiovisual streaming, and single-byte-range media responses.

See [instructions.txt](instructions.txt) for development instructions. The working examples under [examples/](examples/) are intended for learning and exploration. Engineering verification, edge cases, and failure fixtures remain under [tests/](tests/), with an overview in [tests/README_TESTS.txt](tests/README_TESTS.txt).

For the current stable release and its quick-start guide, see the [Achieve package on npm](https://www.npmjs.com/package/achieve).

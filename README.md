# Achieve

Achieve is a lightweight, developer-friendly HTTP server for Node.js with a JavaScript servlet programming model. This repository contains the active Achieve 3.0 development work; version `3.0.0-dev.0` is not yet the stable npm release.

Achieve 3.0 requires Node.js 22 or newer and has no runtime dependencies. Production deployments should use a currently supported even-numbered LTS release; Node.js 24 LTS is the preferred current choice for new installations and development.

## Start the development server

From the repository directory:

```text
node start.js
```

The development launcher serves the executable documentation under `examples/` at `http://localhost:8989/`. Windows and Unix-like convenience launchers are also provided as `runw.bat` and `runl.sh`.

Pressing Ctrl-C or sending `SIGTERM` asks Achieve to stop accepting new connections, finish existing requests, and drain enabled server and access logs before the process terminates normally. On the supported Node.js 22+ baseline, normal listener shutdown closes idle HTTP connections. Active, stalled, or upgraded connections can still delay shutdown. Existing HTTP/2 sessions may remain active and continue opening streams until they close; Achieve 3.0 does not track or forcibly close HTTP/2 sessions.

An Achieve application directory contains static resources and server-side servlets. The preferred servlet suffix is `.jss`; servlet source is executed on the server and is protected from static delivery. Extensionless requests remain compatible with legacy `.js` servlets, while an explicit request for a `.js` file continues to serve it as static JavaScript.

Achieve uses the server project's root directory as its default application directory. Use `setAppPath()` to specify a different application directory. URL directories such as `/accounting/`, `/images/`, and `/servlets/` remain ordinary directories inside that one application.

The current development server handles GET, HEAD, and POST requests. It also includes static compression and caching, audiovisual streaming, and single-byte-range media responses.

See [instructions.txt](instructions.txt) for development instructions. The working examples under [examples/](examples/) are intended for learning and exploration. Engineering verification, edge cases, and failure fixtures remain under [tests/](tests/), with an overview in [tests/README_TESTS.txt](tests/README_TESTS.txt).

For the current stable release and its quick-start guide, see the [Achieve package on npm](https://www.npmjs.com/package/achieve).

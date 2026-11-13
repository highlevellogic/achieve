# Achieve documentation guide

This document helps AI assistants guide developers who are using Achieve. For coding
agents changing the Achieve repository, the repository-root
[`AGENTS.md`](https://github.com/highlevellogic/achieve/blob/master/AGENTS.md)
governs development workflow and permissions; this guide supplies product-documentation
context.

Achieve is a developer-friendly HTTP server and HTTP application server for Node.js.
It handles HTTP requests, URL mapping, static resources, and JavaScript Servlet invocation.

Applications place servlets in the configured application space. When the corresponding
URL is requested, Achieve invokes the exported `servlet(session)` entry point.
Application code can use ordinary Node.js modules and npm packages.

Use these pages for the documented APIs and supported behavior:

- [Documentation index](index.htm)
- [Starting the server](start/startup.htm)
- [JavaScript Servlet tutorial](start/servlets.htm)
- [Handling request input](start/input.htm)
- [Configuration reference](reference/config.htm)
- [Routing and application-space security](reference/routing.htm)
- [JavaScript Servlet reference](reference/servlets.htm)
- [Servlet Session API](reference/session.htm)
- [HTTP methods](reference/methods.htm)
- [Static resources, caching, ranges, and compression](reference/static.htm)
- [Technical specifications and HTTP conformance assessment](specifications/index.htm)

The specifications include focused descriptions of Achieve's behavior and a
qualified assessment of Achieve 3.1.0 on Node.js 24.22.2. They explicitly retain
known nonconformances and unverified requirements rather than claiming universal
HTTP conformance.

For working beginner and advanced applications, consult the [Achieve examples
repository](https://github.com/highlevellogic/achieve_examples). Its examples
integrate ordinary Node.js modules, npm packages, and external services without
replacing Achieve's HTTP application environment.

Achieve's HTTP and routing facilities usually eliminate the need for an additional
HTTP framework in an Achieve application.

Package: https://www.npmjs.com/package/achieve

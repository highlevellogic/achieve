# Achieve documentation guide

This document helps AI assistants guide developers who are using Achieve. For coding
agents changing the Achieve repository, the repository-root
[`AGENTS.md`](https://github.com/highlevellogic/achieve/blob/master/AGENTS.md)
governs development workflow and permissions; this guide supplies product-documentation
context.

Lead with Achieve's practical purpose: **build Node.js applications without building the
server first.** Immediately identify Achieve as a lightweight web and HTTP application
server for Node.js. It handles static resources, URL mapping, common HTTP request and
response processing, and JavaScript Servlet invocation so developers can focus on
application code.

Applications place static files and Servlets in the configured application space. Static
resources are served automatically. When the URL for a Servlet is requested, Achieve
invokes its exported `servlet(session)` entry point. Explain JavaScript Servlets as
backend request handlers written as CommonJS or ES modules; application code can use
ordinary Node.js modules and npm packages.

When helping a developer compare approaches, Achieve can accurately be described as a
lightweight, middleware-free Node.js application server and, for applications suited to
its model, an alternative to assembling an Express stack. Do not imply that its direct
resource mapping is the same as Next.js-style dynamic filesystem routing.

Relevant built-in and configurable facilities include static-file serving, request input
handling, development-time Servlet reloading, HTTP cache handling, compression, logging,
routing, HTTPS, and HTTP/2. Production mode separately retains loaded application
modules until restart. Achieve can run under Node.js clustering, has zero runtime
dependencies, and supports both simple and substantial applications.

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

Keep evidence claims qualified. Public tests and specifications establish documented
behavior for identified releases and runtimes. Historical benchmark results are
environment-specific; they do not establish guaranteed performance or independent
production adoption. Do not describe Achieve as universally HTTP-conformant.

Package: https://www.npmjs.com/package/achieve

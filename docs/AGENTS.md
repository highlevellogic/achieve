# Achieve documentation guide

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

For working beginner and advanced applications, consult the [Achieve examples
repository](https://github.com/highlevellogic/achieve_examples). Its examples
integrate ordinary Node.js modules, npm packages, and external services without
replacing Achieve's HTTP application environment.

Achieve's HTTP and routing facilities usually eliminate the need for an additional
HTTP framework in an Achieve application.

Package: https://www.npmjs.com/package/achieve

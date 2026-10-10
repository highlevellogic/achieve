![Achieve — High Level Logic Project](https://highlevellogic.github.io/achieve/images/skyhigh1.jpg)

# Achieve

Achieve is a standards-compliant, production-ready web server implemented on Node.js that is designed to be friendly in development and fast in production.

**2018: V1** was created as a light-weight, developer-friendly, introductory web server for education.

**2020: V2** introduced additional features such as ETags, compression, streaming video, and more.

**2026: V3** emerges as a modern, standards-compliant web server for business, industry, and education without losing its original developer friendliness.

This document provides an overview of Achieve's features and a brief introduction to JavaScript Servlets, Achieve's distinctive approach to connecting HTTP requests directly to backend application code.

Tutorials, detailed references, and advanced examples are available in the [project documentation](https://highlevellogic.github.io/achieve/index.htm).

## A word from the developer

After decades in software engineering, I found myself in semi-retirement working part-time as a high school teacher with courses in introductory programming and web development. I thought it would be great to have a very easy to use server with backend programming in JavaScript. So, I built one. That was achieve v1, 2018.

There is a lot to learning end-to-end web programming for the first time. Students should focus on the process and writing application code with as few unnecessary details and distractions as possible. This led to having the server deal with more than servers normally do. Content-Type, routing, reloading edited code, finishing the HTTP response, and handling errors in application code among them. And it needed to be forgiving and reliable.

As I used the server myself for teaching, demonstrations, and additional software products for education, I found it was good for me too. The development process became exceptionally efficient without introducing limitations. Efficient, reliable functionality in the server was always available for reuse. This made v3 worth building; a standards-compliant, production-ready web server. In other words, a commercial-grade web server for professionals.

This document presents features and gives a very brief introduction to backend JavaScript servlets. I hope it will capture your interest or at least curiosity. If so, I recommend the [Getting Started section of the documentation](https://highlevellogic.github.io/achieve/index.htm) on the project web site. It is an efficient tutorial. Other resources there include a complete reference section and advanced examples.

I hope you will try achieve and enjoy using it as much as I have.

m.v.h.<br>
Roger

## Contents

- [A web application in a few lines](#a-web-application-in-a-few-lines)
- [JavaScript Servlets: backend logic without HTTP boilerplate](#javascript-servlets-backend-logic-without-http-boilerplate)
- [HTTP, HTTPS, and HTTP/2](#http-https-and-http2)
- [Built-in static file serving](#built-in-static-file-serving)
- [ETags and conditional requests](#etags-and-conditional-requests)
- [Automatic HTTP compression](#automatic-http-compression)
- [Media streaming and byte ranges](#media-streaming-and-byte-ranges)
- [URL routing and path mapping](#url-routing-and-path-mapping)
- [Query parameters, forms, and JSON](#query-parameters-forms-and-json)
- [Cross-origin resource sharing (CORS)](#cross-origin-resource-sharing-cors)
- [Built-in and custom HTTP methods](#built-in-and-custom-http-methods)
- [Server logging and diagnostics](#server-logging-and-diagnostics)
- [Live development reloading and production mode](#live-development-reloading-and-production-mode)
- [Testing and technical review](#testing-and-technical-review)
- [Tutorials and reference documentation](#tutorials-and-reference-documentation)
- [Advanced application examples](#advanced-application-examples)
- [License](#license)

## A web application in a few lines

An Achieve application needs a startup file and an explicitly selected application space: the directory containing the web resources and servlets that Achieve makes available. The small example below shows both static content and backend code served without assembling a middleware stack.

Install Achieve in your project with npm:

```bash
npm install achieve
```

```text
my-app/
├── start.js
└── application/
    ├── index.html
    └── servlets/
        └── hello.jss
```

`start.js` selects that application space explicitly and starts HTTP on port 8989:

```javascript
const achieve = require("achieve");

achieve.setAppPath("./application");
achieve.listen(8989);
```

A static `application/index.html` is available at `http://localhost:8989/`. A backend servlet in `application/servlets/hello.jss` can be just as direct:

```javascript
exports.servlet = function (session) {
    let name = session.params.name;
    return "Hello, " + name;
}
```

Request `http://localhost:8989/servlets/hello.jss?name=World`. Achieve locates and invokes the servlet, parses the query parameter into `session.params`, and turns the returned value into the HTTP response.

See [Starting the server](https://highlevellogic.github.io/achieve/start/startup.htm) and [Your first servlet](https://highlevellogic.github.io/achieve/start/servlets.htm) for the guided version.

## JavaScript Servlets: backend logic without HTTP boilerplate

JavaScript Servlets are backend modules exporting a servlet(session) function. Achieve invokes them in response to HTTP requests, provides parsed input and the underlying Node.js request/response objects, and can turn returned values into responses. The benefit is simple application logic without repeatedly writing routine HTTP handling code.

### Friendly development cycle

In the default development mode, edit a servlet and make another request. Achieve automatically reloads the changed source without restarting the server. That keeps the edit/test cycle short.

For example, this servlet deliberately throws an error during execution:

```javascript
exports.servlet = function () {
    throw new Error("Deliberate servlet error");
}
```

Achieve catches errors that reach its managed invocation, produces a concise developer diagnostic in development mode, and keeps the server available for subsequent requests. Correct the servlet, make another request, and the changed source is loaded.

### Managed backend modules

`session.load(filename)` loads application-side helpers relative to the current servlet. Explicit filenames select CommonJS or ESM behavior. CommonJS loads synchronously; ESM loads return a Promise and can be awaited. Development mode reloads a directly loaded helper after it changes, while production mode uses stable process-local module references.

```javascript
export async function servlet(session) {
    const formatter = await session.load("helpers/formatter.jss.mjs");
    return formatter.format(session.params.name);
}
```

### CommonJS, ESM, synchronous, and Promise results

| Filename | Module form |
| --- | --- |
| `example.jss` | CommonJS servlet |
| `example.jss.cjs` | Explicit CommonJS servlet |
| `example.jss.mjs` | ES module servlet |

Servlets may return an immediate value, a Promise, or use `async`/`await`. With normal automatic completion, Achieve waits for a returned Promise and applies the same response rules to its resolved value. See the [JavaScript Servlets Reference](https://highlevellogic.github.io/achieve/reference/servlets.htm) for details.

### Full Node.js access and application-owned responses

The session exposes the real Node.js request and response objects as session.request and session.response. Achieve can finish ordinary responses for you, but it does not take away control: set session.autoEnd = false when the application will complete the response itself:

```javascript
exports.servlet = function (session) {
    session.autoEnd = false;
    session.response.write("Hello ");
    session.response.end("World!");
}
```

The default is `true`. Achieve still handles errors that reach its managed invocation when it can safely respond; errors in detached timers, callbacks, or other work that continues after the servlet returns remain the application's responsibility.

See the [Servlet Reference](https://highlevellogic.github.io/achieve/reference/servlets.htm) and [Session Object Reference](https://highlevellogic.github.io/achieve/reference/session.htm).

## HTTP, HTTPS, and HTTP/2

Achieve supports HTTP/1.1, HTTPS, cleartext HTTP/2 (h2c), and secure HTTP/2. Select the listener appropriate to your deployment without building protocol handling into the application. Multiple listeners can share one configured application space when bound to distinct ports.

Achieve implements and regression-tests HTTP semantics including method dispatch, conditional requests, byte ranges, response status and body rules, CORS decisions, and protocol-specific listener behavior.

Listener forms and TLS options are documented in [Starting the server](https://highlevellogic.github.io/achieve/start/startup.htm).

## Built-in static file serving

Place files in the configured application space and Achieve serves them directly, including directory defaults and appropriate MIME types. Servlet source is protected, and resolved paths remain within the application boundary. There is no static-file middleware to choose, configure, or maintain.

Static handling is built in; an application does not need to register a static middleware layer. See the [Static Resources Reference](https://highlevellogic.github.io/achieve/reference/static.htm).

## ETags and conditional requests

Achieve can supply ETag and Last-Modified validators and evaluate conditional requests, allowing browsers and clients to reuse unchanged content and avoid unnecessary transfers. It handles the HTTP precondition rules for supported requests instead of leaving application code to implement them. Validators distinguish compressed and uncompressed representations.

## Automatic HTTP compression

Enable compression and Achieve negotiates gzip or deflate for eligible resources, selects an acceptable representation, and manages its cached compressed artifacts. Applications do not need to perform content-encoding negotiation or compression themselves.

## Media streaming and byte ranges

Achieve provides a configurable audio/video streaming path with single byte-range support, so clients can request a portion of a media file rather than always transferring the whole resource. It handles HEAD, partial-response status, range headers, and content lengths. Multipart byte-range responses are not supported. When a request specifies multiple ranges, Achieve serves the first satisfiable range as a single-part response.

## URL routing and path mapping

Ordinary URLs map directly into the configured application space. Exact and subtree route mappings let you give resources public-facing URLs without moving files or writing dispatch code. Exact mappings take precedence; subtree mappings use the longest matching prefix.

Routing changes public names without weakening application-space containment. See the [Routing Reference](https://highlevellogic.github.io/achieve/reference/routing.htm).

## Query parameters, forms, and JSON

Achieve makes GET query parameters available through session.params and parses supported POST form and JSON input into the same property, subject to a configurable size limit. Servlets can work with common inputs immediately, while other bodies remain accessible through the underlying Node.js request stream.

See the [Handling Input](https://highlevellogic.github.io/achieve/start/input.htm) tutorial.

## Cross-origin resource sharing (CORS)

Configure permitted origins and application-relative paths with allowOrigins(). Achieve handles matching cross-origin requests and preflight decisions in the server, instead of requiring each servlet to repeat CORS logic. Requests carrying an Origin header without a matching permission are refused.

Exact-origin policy maps are selected ahead of the wildcard-origin map, and path specificity is evaluated within the selected map. See [CORS configuration](https://highlevellogic.github.io/achieve/reference/config.htm#allowOrigins) for the precise forms and precedence rules.

## Built-in and custom HTTP methods

Achieve handles GET, HEAD, POST, and OPTIONS directly. For additional standard or application-defined methods, register a servlet that implements the required behavior—such as a DELETE operation with application-specific authorization—without writing a new method dispatcher.

```javascript
achieve.registerMethod("DELETE", "methods/delete.jss");
```

The registered servlet receives the session and handles the request using the same return values, Promises, status codes, and error handling as other JavaScript Servlets. Achieve also includes registered methods in the appropriate HTTP `Allow` headers.

See the [HTTP Methods Reference](https://highlevellogic.github.io/achieve/reference/methods.htm).

## Server logging and diagnostics

Achieve displays startup and configuration information on the console. In development mode, it also provides diagnostic information when managed requests encounter errors. Production mode suppresses these developer-oriented request diagnostics.

Persistent server and access logging can be configured independently using `setLogging()` and `setLogPath()`. Persistent logging is disabled by default. See the [Configuration Reference](https://highlevellogic.github.io/achieve/reference/config.htm).

## Live development reloading and production mode

### Development

In the default development mode, Achieve automatically detects changes to directly loaded application modules and reloads them on subsequent requests, without restarting the server. Managed request errors also produce developer-oriented console diagnostics.

### Production

Production mode uses stable module caching until restart, eliminating development-only checks for source changes. Routine developer-oriented console diagnostics are also disabled. Persistent server and access logging remain independently configurable.

Both modes use the same application design. Mode, caching, compression, input limits, logging, MIME types, routing, methods, and CORS are configuration choices; see the [Configuration Reference](https://highlevellogic.github.io/achieve/reference/config.htm).

## Testing and technical review

Achieve 3.0.0 has undergone technical review and automated testing of functional behavior, reliability and error handling, security boundaries, and HTTP standards-related behavior. Regression coverage includes routing, JavaScript Servlets, static resources, conditional requests, compression, byte ranges, and response completion.

The automated validation comprises 37 verifier suites. All 37 suites passed on both Windows and Ubuntu using Node.js 22.x in GitHub Actions on October 8, 2026 (commit `edf25865`). The tests, validation workflow, and CI execution results are publicly available:

- [Automated test source](https://github.com/highlevellogic/achieve/tree/master/tests)
- [Cross-platform validation workflow and run history](https://github.com/highlevellogic/achieve/actions/workflows/test.yml)
- [Successful Windows and Ubuntu validation run](https://github.com/highlevellogic/achieve/actions/runs/37823012538)

To repeat the automated checks in a development checkout, run `npm run validate`.

## Tutorials and reference documentation

The [Achieve v3 documentation](https://highlevellogic.github.io/achieve/index.htm) is divided into short Getting Started tutorials and focused Reference pages.

### Getting Started

- [Starting the server](https://highlevellogic.github.io/achieve/start/startup.htm)
- [Static content and audio/video](https://highlevellogic.github.io/achieve/start/static.htm)
- [Your first servlet](https://highlevellogic.github.io/achieve/start/servlets.htm)
- [Handling Input](https://highlevellogic.github.io/achieve/start/input.htm)

### Reference

- [Configuration](https://highlevellogic.github.io/achieve/reference/config.htm)
- [Routing](https://highlevellogic.github.io/achieve/reference/routing.htm)
- [Static Resources](https://highlevellogic.github.io/achieve/reference/static.htm)
- [HTTP Methods](https://highlevellogic.github.io/achieve/reference/methods.htm)
- [JavaScript Servlets](https://highlevellogic.github.io/achieve/reference/servlets.htm)
- [Servlet Session Object](https://highlevellogic.github.io/achieve/reference/session.htm)

## Advanced application examples

The [Advanced Examples section of the Achieve documentation](https://highlevellogic.github.io/achieve/index.htm#examples) is the permanent location for examples downloads and installation instructions. The final examples ZIP will provide a complete, ready-to-run Achieve development project for newcomers, students, teachers, and experienced developers. It is not yet available while the registry-based installation is being finalized.

After extracting the final ZIP, open a terminal in `achieve_examples` and run:

```bash
npm install
npm start
```

The project obtains Achieve and its supporting dependencies from npm. Open <http://localhost:8989/> to start exploring, then examine and modify the included applications or use the project as a starting point for your own work. Developers who prefer to create a project from scratch can continue to use the minimal installation and startup examples above.

The demonstrations cover integrations and multi-process applications:

- MySQL
- WebSockets and Rooms
- Cluster
- XML/SAX streaming
- Distributed computing
- SOAP

These are demonstrations of Achieve working with other Node.js packages and external services, not additional core Achieve APIs. The included `INSTALL.htm` opens directly in a browser and provides the specialized startup commands and optional MySQL setup. The maintained source material is in the [Achieve examples repository](https://github.com/highlevellogic/achieve_examples).

## License

Achieve is released under the MIT License. See the [LICENSE file](LICENSE) for the complete terms.

Copyright © 2018–2026 Roger F. Gay.

Achieve 3.0.0 · [Source repository](https://github.com/highlevellogic/achieve) · [Documentation index](https://highlevellogic.github.io/achieve/index.htm)

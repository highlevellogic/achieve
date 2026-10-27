<p><img src="https://highlevellogic.github.io/achieve/images/skyhigh1.jpg" alt="Achieve — High Level Logic Project"></p>

<h1><a id="achieve" name="achieve"></a>Achieve</h1>

<p><em><strong>Build apps without frameworks or middleware. Just write your application code. Let Achieve do the server work.</strong></em></p>

<p>Achieve is a standards-compliant, production-ready web and application server implemented on Node.js.</p>

<p>The v3 development process was complemented by extensive automated testing, analysis, and review for <ins><em>standards compliance, reliability, and performance</em></ins>.</p>

<p>This document provides a quick introduction and overview of Achieve's features. Tutorials, detailed references, and examples are available in the <a href="https://highlevellogic.github.io/achieve/index.htm">project documentation</a>.</p>

<h2><a id="introduction" name="introduction"></a>Introduction</h2>

<p>Install Achieve, <code>npm i achieve</code>, and it’s ready to serve.</p>

<p>Achieve has a variety of <a href="https://highlevellogic.github.io/achieve/reference/config.htm">configuration options</a>, but only 3 lines are required to run the server. Use either <code>require</code> or <code>import</code>. See <a href="https://highlevellogic.github.io/achieve/start/startup.htm">Starting the server</a> for more details.</p>

<pre><code>const achieve = require("achieve");
achieve.setAppPath("c:/myapps/");
achieve.listen(8989);</code></pre>

<p>In this example, the server is running HTTP. The port has been set to 8989. Application code is stored in <code>c:/myapps/</code>. So, if you have <code>index.html</code> in that directory, it will be served in response to <code>localhost:8989</code>. Content in subdirectories use URLs that follow the directory path, for example: <code>js/main.js</code> will map to <code>c:/myapps/js/main.js</code>.</p>

<p>Achieve also supports <a href="https://highlevellogic.github.io/achieve/start/startup.htm">HTTPS and HTTP/2</a> as well as <a href="https://highlevellogic.github.io/achieve/reference/routing.htm">custom routing options</a>.</p>

<p>Servlets are entry points into backend applications, written in either CommonJS or ESM, synchronous or asynchronous. See <a href="https://highlevellogic.github.io/achieve/start/servlets.htm">Your first servlet</a> for more details.</p>

<pre><code>exports.servlet = function (session) {
    /* Your application code here */
}</code></pre>

<p>If your JavaScript servlet is <code>c:/myapps/servlets/hello.jss</code>, Achieve will load and execute in response to URL <code>servlets/hello.jss</code> – same default routing as static content. Ordinary standards apply, for example a GET request to that servlet could be <code>servlets/hello.jss?name=Richard</code>. Then the name Richard can be accessed using <code>session.params.name</code>.</p>

<p>Servlets have special features for keeping simple things very simple and safe and eliminating annoying distractions. But they also serve as entry points to complex backend development. Whatever you need to do. Consider the following simple servlet.</p>

<pre><code>exports.servlet = function (session) {
   return "Hello World!";
}</code></pre>

<p>Achieve handles the HTTP response. Now modify the servlet and save the file without restarting the server.</p>

<pre><code>exports.servlet = function (session) {
   let response = "Hello Big World!";
   return response;
}</code></pre>

<p>In development mode (default), Achieve detects the change and automatically reloads the servlet. It also handles errors.</p>

<pre><code>exports.servlet = function (session) {
   let response = “Hello Big   // ERROR!!!
   return response;
}</code></pre>

<p>The server doesn’t crash. A message is returned telling you where the error is. Just fix it and continue to work.</p>

<p>The <a href="https://highlevellogic.github.io/achieve/reference/session.htm">session object</a> parameter is helpful and powerful. Among other things, it provides access to the Node request and response objects. You can work directly with request streams, set response headers, and stream large amounts of data to clients. You can also take control of the HTTP response by setting <code>session.autoEnd = false</code>. This is only required when the servlet returns before an asynchronous operation finishes and a callback will complete the response, as in the following example.</p>

<pre><code>const fs = require("node:fs");

exports.servlet = function (session) {
 session.autoEnd = false;

 fs.readFile("message.txt", "utf8", function (err, data) {
 if (err) {
 session.response.statusCode = 500;
 session.response.end("Unable to read file");
 return;
 }

 session.response.end(data);
 });
};</code></pre>

<h3><a id="servlet-filenames" name="servlet-filenames"></a><a id="commonjs-esm-synchronous-and-promise-results" name="commonjs-esm-synchronous-and-promise-results"></a>Servlet filenames</h3>

<p>The <code>.jss</code> extension identifies a JavaScript Servlet that Achieve executes but never serves as source code. An additional <code>.cjs</code> or <code>.mjs</code> extension specifies the JavaScript module format.</p>

<table>
<thead>
<tr><th>Filename</th><th>Module form</th></tr>
</thead>
<tbody>
<tr><td><code>example.jss</code></td><td>CommonJS servlet</td></tr>
<tr><td><code>example.jss.cjs</code></td><td>Explicit CommonJS servlet</td></tr>
<tr><td><code>example.jss.mjs</code></td><td>ES module servlet</td></tr>
</tbody>
</table>

<h2><a id="contents" name="contents"></a>Contents</h2>

<ul>
<li><a href="#http-https-and-http2">HTTP, HTTPS, and HTTP/2</a></li>
<li><a href="#built-in-static-file-serving">Built-in static file serving</a></li>
<li><a href="#etags-and-conditional-requests">ETags and conditional requests</a></li>
<li><a href="#automatic-http-compression">Automatic HTTP compression</a></li>
<li><a href="#media-streaming-and-byte-ranges">Media streaming and byte ranges</a></li>
<li><a href="#url-routing-and-path-mapping">URL routing and path mapping</a></li>
<li><a href="#query-parameters-forms-and-json">Query parameters, forms, and JSON</a></li>
<li><a href="#cross-origin-resource-sharing-cors">Cross-origin resource sharing (CORS)</a></li>
<li><a href="#built-in-and-custom-http-methods">Built-in and custom HTTP methods</a></li>
<li><a href="#server-logging-and-diagnostics">Server logging and diagnostics</a></li>
<li><a href="#live-development-reloading-and-production-mode">Live development reloading and production mode</a></li>
<li><a href="#testing-and-technical-review">Testing and technical review</a></li>
<li><a href="#tutorials-and-reference-documentation">Tutorials and reference documentation</a></li>
<li><a href="#advanced-application-examples">Advanced application examples</a></li>
<li><a href="#license">License</a></li>
</ul>

<p>See the <a href="https://highlevellogic.github.io/achieve/reference/servlets.htm">Servlet Reference</a> and <a href="https://highlevellogic.github.io/achieve/reference/session.htm">Session Object Reference</a>.</p>

<h2><a id="http-https-and-http2" name="http-https-and-http2"></a>HTTP, HTTPS, and HTTP/2</h2>

<p>Achieve supports HTTP/1.1, HTTPS, cleartext HTTP/2 (h2c), and secure HTTP/2. Select the listener appropriate to your deployment without building protocol handling into the application. Multiple listeners can share one configured application space when bound to distinct ports.</p>

<p>Achieve implements and regression-tests HTTP semantics including method dispatch, conditional requests, byte ranges, response status and body rules, CORS decisions, and protocol-specific listener behavior.</p>

<p>Listener forms and TLS options are documented in <a href="https://highlevellogic.github.io/achieve/start/startup.htm">Starting the server</a>.</p>

<h2><a id="built-in-static-file-serving" name="built-in-static-file-serving"></a>Built-in static file serving</h2>

<p>Place files in the configured application space and Achieve serves them directly, including directory defaults and appropriate MIME types. Servlet source is protected, and resolved paths remain within the application boundary. There is no static-file middleware to choose, configure, or maintain.</p>

<p>Static handling is built in; an application does not need to register a static middleware layer. See the <a href="https://highlevellogic.github.io/achieve/reference/static.htm">Static Resources Reference</a>.</p>

<h2><a id="etags-and-conditional-requests" name="etags-and-conditional-requests"></a>ETags and conditional requests</h2>

<p>Achieve can supply ETag and Last-Modified validators and evaluate conditional requests, allowing browsers and clients to reuse unchanged content and avoid unnecessary transfers. It handles the HTTP precondition rules for supported requests instead of leaving application code to implement them. Validators distinguish compressed and uncompressed representations.</p>

<h2><a id="automatic-http-compression" name="automatic-http-compression"></a>Automatic HTTP compression</h2>

<p>Enable compression and Achieve negotiates gzip or deflate for eligible resources, selects an acceptable representation, and manages its cached compressed artifacts. Applications do not need to perform content-encoding negotiation or compression themselves.</p>

<h2><a id="media-streaming-and-byte-ranges" name="media-streaming-and-byte-ranges"></a>Media streaming and byte ranges</h2>

<p>Achieve provides a configurable audio/video streaming path with single byte-range support, so clients can request a portion of a media file rather than always transferring the whole resource. It handles HEAD, partial-response status, range headers, and content lengths. Multipart byte-range responses are not supported. When a request specifies multiple ranges, Achieve serves the first satisfiable range as a single-part response.</p>

<h2><a id="url-routing-and-path-mapping" name="url-routing-and-path-mapping"></a>URL routing and path mapping</h2>

<p>Ordinary URLs map directly into the configured application space. Exact and subtree route mappings let you give resources public-facing URLs without moving files or writing dispatch code. Exact mappings take precedence; subtree mappings use the longest matching prefix.</p>

<p>Routing changes public names without weakening application-space containment. See the <a href="https://highlevellogic.github.io/achieve/reference/routing.htm">Routing Reference</a>.</p>

<h2><a id="query-parameters-forms-and-json" name="query-parameters-forms-and-json"></a>Query parameters, forms, and JSON</h2>

<p>Achieve makes GET query parameters available through <code>session.params</code> and parses supported POST form and JSON input into the same property, subject to a configurable size limit. Servlets can work with common inputs immediately, while other bodies remain accessible through the underlying Node.js request stream.</p>

<p>See the <a href="https://highlevellogic.github.io/achieve/start/input.htm">Handling Input</a> tutorial.</p>

<h2><a id="cross-origin-resource-sharing-cors" name="cross-origin-resource-sharing-cors"></a>Cross-origin resource sharing (CORS)</h2>

<p>Configure permitted origins and application-relative paths with <code>allowOrigins()</code>. Achieve handles matching cross-origin requests and preflight decisions in the server, instead of requiring each servlet to repeat CORS logic. Requests carrying an Origin header without a matching permission are refused.</p>

<p>Exact-origin policy maps are selected ahead of the wildcard-origin map, and path specificity is evaluated within the selected map. See <a href="https://highlevellogic.github.io/achieve/reference/config.htm#allowOrigins">CORS configuration</a> for the precise forms and precedence rules.</p>

<h2><a id="built-in-and-custom-http-methods" name="built-in-and-custom-http-methods"></a>Built-in and custom HTTP methods</h2>

<p>Achieve handles GET, HEAD, POST, and OPTIONS directly. For additional standard or application-defined methods, register a servlet that implements the required behavior—such as a DELETE operation with application-specific authorization—without writing a new method dispatcher.</p>

<pre><code>achieve.registerMethod("DELETE", "methods/delete.jss");</code></pre>

<p>The registered servlet receives the session and handles the request using the same return values, Promises, status codes, and error handling as other JavaScript Servlets. Achieve also includes registered methods in the appropriate HTTP <code>Allow</code> headers.</p>

<p>See the <a href="https://highlevellogic.github.io/achieve/reference/methods.htm">HTTP Methods Reference</a>.</p>

<h2><a id="server-logging-and-diagnostics" name="server-logging-and-diagnostics"></a>Server logging and diagnostics</h2>

<p>Achieve displays startup and configuration information on the console. In development mode, it also provides diagnostic information when managed requests encounter errors. Production mode suppresses these developer-oriented request diagnostics.</p>

<p>Persistent server and access logging can be configured independently using <code>setLogging()</code> and <code>setLogPath()</code>. Persistent logging is disabled by default. See the <a href="https://highlevellogic.github.io/achieve/reference/config.htm">Configuration Reference</a>.</p>

<h2><a id="live-development-reloading-and-production-mode" name="live-development-reloading-and-production-mode"></a>Live development reloading and production mode</h2>

<h3><a id="development" name="development"></a>Development</h3>

<p>In the default development mode, Achieve automatically detects changes to directly loaded application modules and reloads them on subsequent requests, without restarting the server. Managed request errors also produce developer-oriented console diagnostics.</p>

<h3><a id="production" name="production"></a>Production</h3>

<p>Production mode uses stable module caching until restart, eliminating development-only checks for source changes. Routine developer-oriented console diagnostics are also disabled. Persistent server and access logging remain independently configurable.</p>

<p>Both modes use the same application design. Mode, caching, compression, input limits, logging, MIME types, routing, methods, and CORS are configuration choices; see the <a href="https://highlevellogic.github.io/achieve/reference/config.htm">Configuration Reference</a>.</p>

<h2><a id="testing-and-technical-review" name="testing-and-technical-review"></a>Testing and technical review</h2>

<p>Achieve 3 has undergone technical review and automated testing of functional behavior, reliability and error handling, security boundaries, and HTTP standards-related behavior. Regression coverage includes routing, JavaScript Servlets, static resources, conditional requests, compression, byte ranges, and response completion.</p>

<p>The automated validation comprises 37 verifier suites. All 37 suites passed on both Windows and Ubuntu using Node.js 22.x in GitHub Actions on October 8, 2026 (commit <code>edf25865</code>). The tests, validation workflow, and CI execution results are publicly available:</p>

<ul>
<li><a href="https://github.com/highlevellogic/achieve/tree/master/tests">Automated test source</a></li>
<li><a href="https://github.com/highlevellogic/achieve/actions/workflows/test.yml">Cross-platform validation workflow and run history</a></li>
<li><a href="https://github.com/highlevellogic/achieve/actions/runs/37823012538">Successful Windows and Ubuntu validation run</a></li>
</ul>

<p>To repeat the automated checks in a development checkout, run <code>npm run validate</code>.</p>

<h2><a id="tutorials-and-reference-documentation" name="tutorials-and-reference-documentation"></a>Tutorials and reference documentation</h2>

<p>The <a href="https://highlevellogic.github.io/achieve/index.htm">Achieve v3 documentation</a> is divided into short Getting Started tutorials and focused Reference pages.</p>

<h3><a id="getting-started" name="getting-started"></a>Getting Started</h3>

<ul>
<li><a href="https://highlevellogic.github.io/achieve/start/startup.htm">Starting the server</a></li>
<li><a href="https://highlevellogic.github.io/achieve/start/static.htm">Static content and audio/video</a></li>
<li><a href="https://highlevellogic.github.io/achieve/start/servlets.htm">Your first servlet</a></li>
<li><a href="https://highlevellogic.github.io/achieve/start/input.htm">Handling Input</a></li>
</ul>

<h3><a id="reference" name="reference"></a>Reference</h3>

<ul>
<li><a href="https://highlevellogic.github.io/achieve/reference/config.htm">Configuration</a></li>
<li><a href="https://highlevellogic.github.io/achieve/reference/routing.htm">Routing</a></li>
<li><a href="https://highlevellogic.github.io/achieve/reference/static.htm">Static Resources</a></li>
<li><a href="https://highlevellogic.github.io/achieve/reference/methods.htm">HTTP Methods</a></li>
<li><a href="https://highlevellogic.github.io/achieve/reference/servlets.htm">JavaScript Servlets</a></li>
<li><a href="https://highlevellogic.github.io/achieve/reference/session.htm">Servlet Session Object</a></li>
</ul>

<h2><a id="advanced-application-examples" name="advanced-application-examples"></a>Advanced application examples</h2>

<p>The <a href="https://highlevellogic.github.io/achieve/index.htm#examples">Achieve Advanced Examples</a> provide a complete, ready-to-run development project for newcomers, students, teachers, and experienced developers. The downloadable ZIP includes installation instructions and examples demonstrating Achieve working with other Node.js packages and services.</p>

<p>After extracting the ZIP, open a terminal in <code>achieve_examples</code> and run:</p>

<pre><code>npm install
npm start</code></pre>

<p>The project obtains Achieve and its supporting dependencies from npm. Open <a href="http://localhost:8989/">http://localhost:8989/</a> to start exploring, then examine and modify the included applications or use the project as a starting point for your own work. Developers who prefer to create a project from scratch can continue to use the minimal installation and startup examples above.</p>

<p>The demonstrations cover integrations and multi-process applications:</p>

<ul>
<li>MySQL</li>
<li>WebSockets and Rooms</li>
<li>Cluster</li>
<li>XML/SAX streaming</li>
<li>Distributed computing</li>
<li>SOAP</li>
</ul>

<p>These are demonstrations of Achieve working with other Node.js packages and external services, not additional core Achieve APIs. The included <code>INSTALL.htm</code> opens directly in a browser and provides the specialized startup commands and optional MySQL setup. The maintained source material is in the <a href="https://github.com/highlevellogic/achieve_examples">Achieve examples repository</a>.</p>

<h2><a id="community-and-support" name="community-and-support"></a>Community and support</h2>

<p>Use <a href="https://github.com/highlevellogic/achieve/discussions">GitHub Discussions</a> for questions, ideas, and general discussion. Report bugs through <a href="https://github.com/highlevellogic/achieve/issues">GitHub Issues</a>.</p>

<h2><a id="license" name="license"></a>License</h2>

<p>Achieve is released under the MIT License. See the <a href="LICENSE">LICENSE file</a> for the complete terms.</p>

<p>Copyright © 2018–2026 Roger F. Gay.</p>

<p>Achieve · <a href="https://github.com/highlevellogic/achieve">Source repository</a> · <a href="https://highlevellogic.github.io/achieve/index.htm">Documentation index</a></p>

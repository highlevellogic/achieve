<section style="background-color:LightSkyBlue;">
Achieve is a modern (http, https, http2) high-performance web server that runs on Node.js and uses JavaScript Servlets to initiate back end processing.
<a href="https://hll.nu"><img src="https://hll.nu/achieve/skyhigh1.jpg"></a>
<h3><i>NEWS:</i> Proxy capability added: see <a href="https://www.npmjs.com/package/achieve-proxy" target="_blank">achieve-proxy</a>.</h3>
<h1>Achieve Node.js Server with JavaScript Servlets</h1>
<p><span style="font-family:'Merienda';font-size:125%;font-weight:bold;color:rgb(46, 190, 43);">Achieve</span> is a modern (http, https, http2) web server 
that runs on Node.js and uses JavaScript Servlets to initiate back end processing. It is available via npm.<p>
<p>This is a quick-start guide. If you need more help getting started, from using localhost and local IP addresses to 
obtaining security certificates 
and forwarding ports, <a href="https://hll.nu/achieve/contents.htm" target="_blank">click here</a>.</p>
<p>Achieve is part of the <a href="https://hll.nu">High Level Logic Project</a>.</p>
<h2>Features Summary</h2>
<h3>Regular HTTP features:</h3>
<ul>
<li>Delivers static content.</li>
<li>Unlimited MIME support.</li>
<li>Runs back-end JavaScript programs (via JavaScript Servlets).</li>
<li>Supports defaults index.html, index.htm, index.js</li>
<li>Supports browser caching. (ETag)</li>
<li>Supports compression with ss caching. (gzip,deflate)</li>
<li>Streaming audio/video files.</li>
</ul>
<h3>Special Features:</h3>
<ul>
<li>No knowledge of Node.js required to start using JS Servlets.</li>
<li>Little knowledge of JavaScript required to start using JS Servlets.</li>
<li>Servlets handle HTTP/S Response. App just uses return statement.</li>
<li>Useful app error reports can be displayed in browser console.</li>
<li>Automatic reload of modified files.</li>
<li>Servlet Session Object allows developer to take complete control.</li>
<li>Node.js environment configuration. (development,production)</li>
<li>Configurable apps folder path and path to the ROOT application.</li>
</ul>

<h2>Quick Start</h2>
<p>Install Node.js</p>
<h3>Achieve HTTP:</h3>
<h3>Running Achieve HTTP (simplest form):</h3>
<pre><code>
const server = require('achieve');
server.listen();  // defaults to port 80
</code></pre>
<p>By default, the base application directory is the same as the file you create to start the server. 
You can set the base application directory with the setAppPath option below.</p>
<h3>Running Achieve with options:</h3>
<pre><code>
const server = require('achieve');

server.setAppPath("c:/myachieve/myapps");                // set base directory for all applications
server.setRootDir('root');                               // set a subdirectory under the root directory for THE ROOT application
server.setCaching(true);                                 // turn browser caching support on
server.setCompress(true);                                // compress static resources
server.showMimeTypes();                                  // Show the current list of supported MIME Types
server.addMimeType("pub","application/x-mspublisher");   // add an unsupported MIME type
server.addAVMimeType("wav","audio/wav");                 // add an unsupported AV MIME type
server.setNodeEnv("development");                        // set Node environment 

server.listen(8989);  // listens on port 8989
</code></pre>
<h3>Hello World Servlet:</h3>
<pre><code>
// Save this code in file index.js in the apps directory ("application base" - directory where you are running the server)<br>
exports.servlet = function (session)  {
  return "Hello World!";  // Achieve handles the response.
}
</code></pre>
<p>Display results in browser: http://localhost:8989 (assuming port 8989 and the file is named index.js.</p>
<p>Note also that the url is index, without the .js extension. With the .js extension, http://localhost:8989/index.js the file will be served.</p>
<p>Achieve will reload your programs when they've been modified. No need to restart the server.</p>
<h3>Application Code Error Messages in browser console:</h3>
<p>Modify your servlet to cause an error by deleting a few characters from the end of the return statement: 
<code style="margin-left:0px;display:inline-block;font-weight:bold;">return "Hello World</code>. Refresh the page.</p>
<p>To see how to receive error message in the browser's console, save <a href='http://hll.nu/achieve/samp1/index.htm' download='index.htm' target="_blank">this</a>
HTML file and save it to your apps directory as index.htm. Open the inspector in your browser and click on the console tab. Then 
reload http://localhost:8989 On the browser side, the trick is in the callback() function.</p>
<h3>Access parameter values that were sent with the request:</h3>
<pre><code>
    var myParm = session.params.myParm;  // or
    var myParm = session.params['myParm'];
</code></pre>
session.request.get and session.request.post are also supported.
<h3>Servlets can use other functions:</h3>
<pre><code>
exports.servlet = function (session)  {
  return hello();
}
function hello ()  {
   return "Hello World!";
}
</code></pre>
<h3>Servlets can use functions in other files.</h3>
<pre><code>
// in otherfile.js
exports.hello () {
  Return "Hello World!";
}

// in myservlet.js
exports.servlet = function (session) {
  var other = session.load("otherfile.js");  // Extends servlet features to otherfile; reloads if cache is stale.
  return other.hello();
}
</code></pre>
<h3>The Servlet Session</h3>
<p style="margin-bottom:0px;">You can use the Servlet Session to take control of your back end process. The Servlet Session contains:</p>
<pre><code>
  session.request    // The session request object.
  session.response   // The session response object.
  session.params      // Parameters sent with the request
  session.dirPath    // The current application path on your computer
  session.load       // The JavaScript Servlet load() method (see above)
  session.allowAsync // Set to true if you handle the response in an asynchronous process.
</code></pre>
<h3>Achieve HTTPS:</h3>
<p><b>Using HTTPS on Achieve</b> is actually quite simple. It shares configuration set-ups with 
Achieve HTTP. The difference is in the listen methods. 
Achieve HTTPS has its own, called slisten(). slisten() requires a JSObject as input, which lists your security certificates. 
Security certificates, and how to obtain them (cost free) is explained below.</p>
<h3>Running Achieve HTTPS (simplest form):</h3>
<pre><code>
  const server = require('achieve');
  const fs = require('fs');
  
  const options = {  // An easy way to acquire free certificates is explained below.
    key: fs.readFileSync('C:/certs/private.key'),   // For certificate files that have been placed in C:/certs/
    ca: fs.readFileSync('C:/certs/bundle.crt'),     // optional, provides "full chain" of certificates
    cert: fs.readFileSync('C:/certs/certificate.crt')
  };
  server.slisten(options);
</code></pre>
<p>Port 443 is the default port for HTTPS. If you need to use a different port, add the port number
to the options object.</p>
<pre><code>
  const options = {
    key: fs.readFileSync('C:/certs/private.key'),
    ca: fs.readFileSync('C:/certs/bundle.crt'),  // optional
    cert: fs.readFileSync('C:/certs/certificate.crt'),
    httpsPort: 7777
  };
</code></pre>
<h3>Achieve HTTP2:</h3>
<p>Install Node.js v10.16.0 or later.</p>
<p><b>Using HTTP2 on Achieve</b> is also easy. It shares configuration set-ups with 
Achieve HTTP/S. It also has its own listen method - listen2(). You may use HTTP2 without encryption and without 
security certificates. Simply follow instructions for HTTP above, but using .listen2() rather than .listen(). Note however 
that browsers are not accepting unencrypted traffic on HTTP2. If your target client is a web browser, or if you need secure 
connections with other clients, follow the instructions for HTTPS above (using .listen2()), but with the <u><i><b>port property 
name http2Port</b></i></u>. Achieve HTTP2 requires Node.js v10.16.0 or higher.</p>
<h3>Copyright and License</h3>
<p>copyright © 2020, Roger F. Gay, may be freely distributed with the MIT license</p>
</section>

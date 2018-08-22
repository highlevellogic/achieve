# achieve
Achieve is a modern HTTP server  that runs on Node.js and uses JavaScript Servlets to initiate back end processing. It is available via <a href="https://www.npmjs.com/package/achieve" target="_blank">npm</a>.
<img src="http://hll.nu/achieve/skyhigh1.jpg">
<h1>Achieve Node.js Server with JavaScript Servlets</h1>
<p><span style="font-family:'Merienda';font-size:125%;font-weight:bold;color:rgb(46, 190, 43);">Achieve</span> is a modern HTTP server 
that runs on Node.js and uses JavaScript Servlets to initiate back end processing. It is available via npm.<p>
<p>For a more detailed quick start tutorial, <a href="" target="http://hll.nu/achieve/">click here</a></p>
<h2>Features Summary</h2>
<h3>Regular HTTP features:</h3>
<ul>
<li>Delivers static content.</li>
<li>Unlimited MIME support.</li>
<li>Runs back-end JavaScript programs (via JavaScript Servlets).</li>
<li>Supports defaults index.html, index.htm, index.js</li>
<li>Supports browser caching. (ETag)</li>
<li>Supports compression with ss caching. (gzip,deflate)</li>
</ul>
<h3>Special Features:</h3>
<ul>
<li>No knowledge of Node.js required to start using JS Servlets.</li>
<li>Little knowledge of JavaScript required to start using JS Servlets.</li>
<li>Servlets handle HTTP Response. App just uses return statement.</li>
<li>Useful app error reports can be displayed in browser console.</li>
<li>Automatic reload of modified files.</li>
<li>Servlet Context Object allows developer to take complete control.</li>
<li>Node.js environment configuration. (development,production)</li>
<li>Configurable apps folder path and path to the ROOT application.</li>
</ul>

<h2>Quick Start</h2>
<p>Install Node.js v8.1 or later. (Developed / tested with v8.9.4)</p>
<h3>Running Achieve (simplest form):</h3>
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
server..showMimeTypes();                                 // Show the current list of supported Mime Types
server.addMimeType("xsl", "application/vnd.ms-excel");   // add an unsupported mime type
server.setNodeEnv("development");                        // set Node environment 

server.listen(8989);  // listens on port 8989
</code></pre>
<h3>Hello World Servlet:</h3>
<pre><code>
// Save this code in file index.js in the apps directory ("application base" - directory where you are running the server)<br>
exports.servlet = function (context)  {
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
    var myParm = context.parms.myParm;  // or
    var myParm = context.parms['myParm'];
</code></pre>

<h3>Servlets can use other functions:</h3>
<pre><code>
exports.servlet = function (context)  {
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
exports.servlet = function (context) {
  var other = context.load("otherfile.js");  // Extends servlet features to otherfile; reloads if cache is stale.
  return other.hello();
}
</code></pre>
<h3>The Servlet Context</h3>
<p style="margin-bottom:0px;">You can use the Servlet Context to take control of your back end process. The Servlet Context contains:</p>
<pre><code>
  context.request    // The session request object.
  context.response   // The session response object.
  context.parms      // Parameters sent with the request
  context.dirPath    // The current application path on your computer
  context.load       // The JavaScript Servlet load() method (see above)
</code></pre>

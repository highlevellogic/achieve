# achieve
Achieve is a modern HTTP server  that runs on Node.js and uses JavaScript Servlets to initiate back end processing.
<html>
<head>
 <title>Achieve Node.js Server with JavaScript Servlets</title>
 <meta charset="UTF-8" />
 <meta name="viewport" content="width=device-width, initial-scale=1.0" />
 <link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACqklEQVQ4T32RW0hUURiF195zzoypo6Z5SY0uDF00rykp5aWHAvGtJCwhL9SURuqQjVCZQQ+JJGZqKt6iNNFJoR4sAiHyRSpRUxOihxJSqqGccWxu55zdi6eOU7be/rXW/8G/N8E6yj2dPqCJdIQwwtRqf4GoA4RZjTOgqv7s6KKyR9cDBKUvDXuF27ereNLWUT6R6pzfeMcmWkf0zQl1/wVc6k0NP9ce+5kyqmvTT2+N3B3aUzYY3ekbKrxrL5mKcpu1YwW3En5caDzk8xfA0H4gxmJdmfNZ1CU35k9eBQAb+ZhB1EIRgqzBANBd/dIkzeyJsy7bBtYAKroyNzt566jua3Zo3bWhBdmXmHRGZQusgpvfIXv37z2cBydpSlpSMn4D7PT7Jw18dMbqmw4oRCg7qA3i6wgvnlT6K8bObLvDUUMBwNCXmMMRL1N9wZhZWTIMxRQQghHLyhJjRDqszB4h3slRzQYOAECgb8h/dQQeYry7ki6EZRGtW2J+Zv9SU/QgUWGTczYis7XqORNdxMEBAFVhm+fyldo875/ipB8LMz+TONdO5qYut43ebimcHgVmAQBELYSsvgFb+xv9SfttUa9tTgtp5e1+e60z3iq4+QpeKybInVOXM7PUAY4PqycQuxIAib0nIhXu5s/ckK2y7pQR+FuM8uwbZTZSUdNFAYCqSIuhL6lJDgkvHWfL2mNKZkPh2JwkkF3yTFUkrSl//AEFAPWXiCGmtZ4v70z3BQCB2muJWnwKD7ks/BMAKO6Kf8HxtHhNaOxNyyszxQ0DQHlPcqrnsix9R1xf6UDsG3kmyvBi/74igXPUgLJxJtApiPyoe5n7xqgQTH1cuZSwo0TiKhtPvP1zLv6hst7EWIlzbgFIDKFSoCQSOxPJRHPe9cdADlN2fwG8FgTEn90+twAAAABJRU5ErkJggg==">
 <link href='http://fonts.googleapis.com/css?family=Merienda|Kalam' rel='stylesheet' type='text/css' />
 <link rel="stylesheet" type="text/css" href="achieve1.css">
</head>
<body>
<header style="font-size:200%;"><img src="blank.gif"></img></header>
<article>
<h1>Achieve Node.js Server with JavaScript Servlets</h1>
<p><span style="font-family:'Merienda';font-size:125%;font-weight:bold;color:rgb(46, 190, 43);">Achieve</span> is a modern HTTP server 
that runs on Node.js and uses JavaScript Servlets to initiate back end processing.<p>
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
<h3>Running Achieve (simplest form):</h3>
<pre><code>
const server = require('achieve');
server.listen();  // defaults to port 80
</code></pre>
<h3>Running Achieve with options:</h3>
<pre><code>
const server = require('achieve');

server.setAppPath("c:/myachieve/myapps");                // set root directory for all applications
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
</article>
</body>
</html>

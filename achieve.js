// Essential modules. Always load. 
global.fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
// Optional modules. Load only when used.

let http;
let https;
let zlib;
// const avmine = require("./avmine");
// const dt = require('./datetime');
// let flatted = require('flatted');

if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'production';

let moduleLoadTimes = {};

let reqCount = 0;
let connectionArray;
   // basePath is the root directory for applications. (Like webapps on Tomcat or htdocs on Apache httpd.)
   // The default is the directory of the entry point or main module for the application.
   // It can be reset by the app developer using .setAppPath(appDir);
 //  let basePath = path.normalize(require.main.filename.substring(0,require.main.filename.lastIndexOf(path.sep)));
   let basePath = require.main.path;
   let rootPath=basePath;
   let relRootPath="";
   let bCaching=false, bCachingCheck=false, rootDir=false, compress=false, showMimes=false;
   let corsdomains=[];
   let shortVersion = require('achieve/package.json').version;
   let version = "HLL Achieve v" + shortVersion;
   let nv = nodeVersion();
   let etagString = nv + shortVersion;
   let defaultCharSet="utf-8";
   let proxies=false;
   let achieve_proxy=false;
   let _this = this;

exports.setProxy = function (prox) {
  if (!proxies) proxies = {};
  try {
    for (var key in prox) proxies[key.replace(/\\/g,"/")] = prox[key];
  } catch (e) {
    console.log("error: problem with proxy object: " + e.message);
  }
}
exports.showMimeTypes = function () {
  showMimes=true;
}
exports.setCompress = function (on) {
  if (typeof on == "boolean") {
    compress=on;
    if (compress) zlib = require('zlib');
  } else {
    console.log("ERROR: setCompress(true) requires a boolean argument. (default: false)");
  }
}
exports.setNodeEnv = function (env) {
  process.env.NODE_ENV=env;
  console.log("NODE_ENV set to " + env);
}
exports.setRootDir = function (root) {
  var theRootPath = path.join(basePath,root);
  if (!fs.existsSync(theRootPath)) fs.mkdirSync(theRootPath);
  if (fs.statSync(theRootPath).isDirectory()) {
    rootDir=true;
    rootPath=theRootPath;
    relRootPath=path.join("/",root);
  }
}
exports.setAppPath = function (bp) {
  try {
  let newPath = path.normalize(bp);
  if (!fs.existsSync(newPath)) {
    console.log("\nWARNING: App. Path: " + newPath + " does not exist.");
  } else {
    basePath = newPath;
    rootPath = basePath;
  }
  } catch (err) {console.log(err);}
}
exports.setCaching = function (b) {
  try {
  if (b && fs.statSync(basePath).mtimeMs === undefined) {
    bCaching=false;
    console.log("\nFAILURE to set browser caching support.\nNode version must be v8 or higher.");
  } else {
    bCaching=b; // boolean
  }
  bCachingCheck=true;
  } catch (err) {
    console.log("ERROR setCaching: " + err);
  }
}
// CORS - not yet implemented
exports.allowAccess = function (ad) {
  let acds;
  if (ad.length > 0) {
    corsdomains = ad.split(",");
  } else {
    console.log("No domains in access list.");
    return;
  }
}
var achieveApp = function (req, res) {
 try {
   // Get information about the requested file or application.
 //  let urlParsed = url.parse(req.headers.referer, true);
   if (req.url.charAt(0) == '/') {
     console.log("url: " + req.url + ", origin: " + req.connection.remoteAddress || req.headers['x-forwarded-for'] || request.socket.remoteAddress || req.connection.socket.remoteAddress);
   } else {
     console.log("url: " + req.url + ", origin: " + req.connection.remoteAddress || req.headers['x-forwarded-for'] || request.socket.remoteAddress || req.connection.socket.remoteAddress);
     res.statusCode=400;
     res.setHeader('Content-Type','text/plain;charset=utf-8');
     res.end("Bad Request");
     return;
   }
   
/* local and remote differ when outside the lan
   console.log("localAddress: " + req.socket.localAddress);
   console.log("remoteAddress: " + req.socket.remoteAddress);
   console.log("remoteAddress: " + req.connection.remoteAddress);
*/
   
   
 //  res.setHeader('Access-Control-Allow-Headers', '*');
  // res.setHeader('Access-Control-Allow-Origin', '*');
  // res.ok = 1;
   req.protocol = this.protocol;
   let fileInfo = setFileInfo(req,res,basePath);
 // display(fileInfo);
   // If request is a directory, it must have a trailing slash (otherwise resources such as css and js won't be loaded).
   if (fileInfo.redirect) {
     var qString = req.url.split("?");
	   var newUrl = path.join(qString[0], "/");
     if (qString.length == 2) newUrl = newUrl+"?"+qString[1];
     res.statusCode = 301;
     res.setHeader('Content-Type', 'text/plain');
     res.setHeader('Location', newUrl);
     res.end('Redirecting to ' + newUrl);
   } else if (fileInfo.contentType === undefined) {
     res.statusCode = 415;
     res.setHeader('Content-Type', 'text/plain');
     res.end('Media type is not supported. Use server.addMimeType() in your application.'); // currently, defaults to text/plain
   // Files are served using the serveFile object in this application.
   } else if (fileInfo.serveFile) {
     try {
	   if (fs.existsSync(fileInfo.fullPath)) {
		 new ServeFile(req,res,fileInfo).init();
	   } else {
		 reportError(res,fileInfo.fullPath,404,"File not found: " + fileInfo.fullPath);
	   }
	 } catch (err) {
		reportError(res,fileInfo.fullPath,500,"Error attempting to serve " + fileInfo.fullPath);
	 }
   } else if (fileInfo.audioVisual) {
     // Bugs related to streaming video over http2.
     if (false /*this.protocol == "http2.https" */) {
       reportError(res,fileInfo.fullPath,500,"Video streaming not supported on HTTP2.");
     } else {
       stream(req,res,fileInfo);
     }
   // If file does not exist, return 404 File not found error.
   } else if (fileInfo.noSuchFile) {
	   reportError(res,fileInfo.fullPath,404,"File not found: " + fileInfo.fullPath);
   // Otherwise, a JavaScript file should be loaded. 
   } else {
	   // Checks and adds JavaScript file.
	   let accountInfo = getAccount(res,fileInfo);
     if (accountInfo.code == 200) {
	     try {
		     // Executes the JavaScript.
		     new startObject(req,res,fileInfo).init();
	     } catch (err) {}
	   } else {
	     reportError(res,accountInfo.account,accountInfo.code,accountInfo.reason);
	   }
   }
 } catch (e) {
   console.log("Catchall error, achieveApp: " + e.stack);
 }
}
exports.listen2 = function (ioptions) {
  http2 = require('http2');
  
  let server;
  let ssl = false;
  let sport, portDefault;

  try {
  if (typeof ioptions === "object") {
    if (ioptions.key === undefined || ioptions.cert === undefined) {
      console.log("FATAL ERROR: Security certification list is insufficient for SSL.");
      return;
    }
    ssl = true;
    portDefault = 443;
    sport = ioptions.http2Port;
  } else {
    portDefault = 80;
    sport = ioptions;
  }

  if (sport === undefined) {
    sport=portDefault;
  } else if (Number.isNaN(sport)) {
    console.log("http2 port " + sport + " is not a number. Setting port to default: " + portDefault + ".");
    sport=portDefault;
  } else if (sport<1024 || sport>49151) {
    console.log("http2 port " + sport + " is outside acceptable range. (1024-49151) Setting port to default: " + portDefault + ".");
    sport=portDefault;
  }
  } catch (err) {
    console.log("Error setting port in listen2(). Setting port to default.")
    sport=portDefault;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);

  if (ssl) {
    server = http2.createSecureServer(ioptions, achieveApp.bind({protocol:"http2.https"})).listen(sport);
  } else {
    server = http2.createServer(achieveApp.bind({protocol:"http2.http"})).listen(sport);
  }

  console.log("\n" + version + " HTTP2 " + (ssl ? "(secure)" : "(insecure)") + " is running on port " + sport + ". (Node.js version " + process.version + ")");
  console.log("Path to application base: " + basePath);
  console.log("Path to root application: " + rootPath);
  console.log("Browser caching: " + (bCaching ? "on" : "off"));
  console.log("Static compression: " + (compress ? "on" : "off"));
  
  console.log("\n");
  return server;
  
}
exports.slisten = function (ioptions) {
  https = require('https');
  
  let server;
  let tlsOptions;
  let sport;

  try {
  if (typeof ioptions !== "object") {
    console.log("FATAL ERROR: slisten() requires an options object as argument.");
    return;
  }
  if (ioptions.key === undefined || ioptions.cert === undefined) {
    console.log("FATAL ERROR: Security certification list is insufficient.");
    return;
  }
  sport = ioptions.httpsPort;
  if (sport === undefined) {
    sport=443;
  } else if (Number.isNaN(sport)) {
    console.log("https port " + sport + " is not a number. Setting port to default.");
    sport=443;
  } else if (sport<1024 || sport>49151) {
    console.log("https port " + sport + " is outside acceptable range. (1024-49151) Setting port to default.");
    sport=443;
  }
  } catch (err) {
    console.log("Error setting port in slisten(). Setting port to default.")
    sport=443;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  
  server = https.createServer(ioptions, achieveApp.bind({protocol:"https"})).listen(sport);
/*
  server.on('connection', function (socket) {
    console.log("*********** CONNECTION : " + JSON.stringify(socket));
    connectionArray = socket;
  });
*/

  console.log("\n" + version + " HTTPS is running on port " + sport + ". (Node.js version " + process.version + ")");
  console.log("Path to application base: " + basePath);
  console.log("Path to root application: " + rootPath);
  console.log("Browser caching: " + (bCaching ? "on" : "off"));
  console.log("Static compression: " + (compress ? "on" : "off"));
  
  console.log("\n");
  return server;
  
}
exports.listen = function (port) {
  http = require('http');
    
  let server;
/*
  if(nv < 8100) {
    console.log("You need to update Node.js to at least v8.1.0 in order to run this software.");
    return;
  }
*/
  try {
  
  if (port === undefined) {
    port=80;
  } else if (Number.isNaN(port)) {
    console.log(port + " is not a number. Setting port to default.");
    port=80;
  } else if (port<1024 || port>49151) {
    console.log("Port " + port + " is outside acceptable range. (1024-49151) Setting port to default.");
    port=80;
  }
  } catch (err) {
    console.log("Error setting port in listen(). Setting port to default.")
    port=80;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  
  server = http.createServer(achieveApp.bind({protocol:"http"})).listen(port);

  console.log("\n" + version + " HTTP is running on port " + port + ". (Node.js version " + process.version + ")");
  console.log("Path to application base: " + basePath);
  console.log("Path to root application: " + rootPath);
  console.log("Browser caching: " + (bCaching ? "on" : "off"));
  console.log("Static compression: " + (compress ? "on" : "off"));
  
  if (showMimes) {
    console.log("\nMIME Types:");
    for (var type in mimeList) {
        console.log(" " + type + ": " + mimeList[type]);
    }
    console.log("\nAudioVisual MIME Types:");
    for (var atype in avMimeList) {
        console.log(" " + atype + ": " + avMimeList[atype]);
    }
  }
  console.log("\n");
  return server;
}

/* A way to check for websocket connection request
server.on("upgrade",function(req,socket,head){
console.log("upgrade: " + req.headers['upgrade'] + " " + typeof socket);
socket.write("hello");
socket.on('data', function(message) {
  console.log(message);
});
});
*/

// extension offers a way to add functionality to the server, which will be available via the context object.
// NOT YET IMPLEMENTED
exports.extension = {};
exports.addExtension = function (name,obj) {
  if (obj === undefined || name.length < 1) {
    console.log("addExtension() error: Two arguments required. First is a string representing the name of the extension. The second is the value of the extension.");
  }
  var nameType=true;
  if (typeof name == "string") {
    this.extension[name]=obj;
  } else {
    console.log("addExtension() error: First argument must be a valid string for name of the extension.");
  }
}
// Supported MIME types, based on file extensions
// You may add new MIME types.
exports.addMimeType = function (ext, mime) {
  try {
  ext=ext.trim(); mime=mime.trim();
  var extType=true, mimeType=true, extForm=true, mimeForm=true;
  if (typeof ext != "string") extType=false;
  if (typeof mime != "string") mimeType=false;
  if (extType && ext.indexOf('.') == 0) ext = ext.substring(1);
  if (extType && ext.indexOf('/') > -1) extForm=false;
  if (mimeType && mime.indexOf('/') < 1) mimeForm=false;
  if (extType && mimeType && extForm && mimeForm) {
    mimeList[ext]=mime;
  } else {
    if (!extType || !extForm) console.log("addMimeType(extension,mime) error: First argument must be a file suffix string such as 'html'");
    if (!mimeType || !mimeForm) console.log("addMimeType(extension,mime) error: Second argument must be a MIME type string such as 'text/html'");
  }
  } catch (err) {console.log(err);}
}
exports.addAVMimeType = function (ext, mime) {
  try {
  ext=ext.trim(); mime=mime.trim();
  var extType=true, mimeType=true, extForm=true, mimeForm=true;
  if (typeof ext != "string") extType=false;
  if (typeof mime != "string") mimeType=false;
  if (extType && ext.indexOf('.') == 0) ext = ext.substring(1);
  if (extType && ext.indexOf('/') > -1) extForm=false;
  if (mimeType && mime.indexOf('/') < 1) mimeForm=false;
  if (extType && mimeType && extForm && mimeForm) {
    avMimeList[ext]=mime;
  } else {
    if (!extType || !extForm) console.log("addAVMimeType(extension,mime) error: First argument must be a file suffix string such as 'html'");
    if (!mimeType || !mimeForm) console.log("addAVMimeType(extension,mime) error: Second argument must be a MIME type string such as 'text/html'");
  }
  } catch (err) {console.log(err);}
}
// "servlet" is not a file extension. It is used by this service to indicate running (not serving) js code.
// "servlet" is required by this service. Default response MIME type for servlet is plain text, UTF-8
let mimeList = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  xml: "application/xml",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  json: "application/json",
  ico: "image/x-icon",
  xsl: "application/xslt+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  servlet: "text/plain"
};
let avMimeList = {
  mp4: "video/mp4",
  m2v: "video/mpeg",
  ogv: "video/ogg",
  m2a: "audio/mpeg",
  mp3: "audio/mpeg3",
  oga: "audio/ogg"
};
function reportError (res,account,statusCode,reason) {
  if (statusCode === undefined) statusCode = 500;
  try {
    delete require.cache[require.resolve(account)];
  } catch (err) {
  } finally {
	  console.log(statusCode + ": " + reason);
    res.statusCode=statusCode;
    res.setHeader('Content-Type','text/plain;charset=utf-8');
    res.end(reason);
  }
}
function FileInfo (basePath,path,fullPath,dirPath,suffix,headers,contentType,queryString,serveFile,redirect,noSuchFile,reload,etag,audioVisual,proxyOptions) {
  this.basePath = basePath;
  this.path = path;
  this.fullPath = fullPath;
  this.dirPath = dirPath;
  this.suffix = suffix;
  this.headers = headers;
  this.contentType = contentType;
  this.queryString = queryString;
  this.serveFile = serveFile;
  this.redirect = redirect;
  this.noSuchFile = noSuchFile;
  this.reload = reload;
  this.etag = etag;
  this.audioVisual = audioVisual;
  this.proxyOptions = proxyOptions;
}
function Context (req,res,parms,dirPath,load,proxyOptions=false,proxies=false,proxy) {
  this.request = req;
  this.response = res;
  this.parms = parms; // deprecate
  this.params = parms;
  this.dirPath = dirPath;
  this.load = load;
  this.proxy = proxy;
  this.proxyOptions = proxyOptions;
  this.proxies = proxies;
  this.rtErrorMsg = rtErrorMsg;
  this.allowAsync = false;
}
function PathInfo (filePath,reload,action,stats) {
  this.filePath = filePath;
  this.reload = reload;
  this.action = action;
  this.stats = stats;
}
function checkPath (basePath,relativePath) {
  // Build full path.
  let action="";
  if (relativePath.length == 0) relativePath="/";
  let fullPath = path.join(basePath,relativePath);
  let stats, checkPath;
  let reload=false;
  if (rootDir && (fs.existsSync(rootPath+relativePath) || fs.existsSync(rootPath+relativePath+".js"))) {
    fullPath = path.join(rootPath,relativePath);
    relativePath = path.join(relRootPath,relativePath);
  }
    try {
      // Does fullPath exist?
	    stats = fs.statSync(fullPath); 
    } catch (err) {
          
    if (fs.existsSync(fullPath+".js")) {
	    stats = fs.statSync(fullPath+".js");
	    if (moduleLoadTimes[fullPath+".js"] === undefined || moduleLoadTimes[fullPath+".js"] < stats.mtimeMs) reload = true;
	    return new PathInfo(path.normalize(relativePath),reload,"servlet",stats);
	  } 
    return new PathInfo(path.normalize(relativePath),false,"noSuchFile",stats);
    }
  // If fullPath points to a file, return the relative path.
  if (stats.isFile()) return new PathInfo(path.normalize(relativePath),true,"serveFile",stats);
  // If fullPath points to a directory:
  if (stats.isDirectory()) {
	// directory requests without trailing '/' are redirected with '/' added
    if (fullPath.charAt(fullPath.length-1) != path.sep) return new PathInfo(path.normalize(relativePath),false,"redirect",stats);
	  // Check for default files like index.html and index.js
	  for (let df of defaultFiles) {
      checkPath = path.join(fullPath,df);
	    if (fs.existsSync(checkPath)) {
		    if (df == "index.js") {
		  	  stats = fs.statSync(checkPath);
			    if (moduleLoadTimes[checkPath] === undefined || moduleLoadTimes[checkPath] < stats.mtimeMs) reload = true;
			    df = "index";
          action = "servlet";
		    } else {
          stats = fs.statSync(checkPath);
          action = "serveFile";
        }
		    return new PathInfo(path.join(relativePath,df),reload,action,stats);
	    }
	  }
  }
  return new PathInfo(relativePath,false,"noSuchFile",stats);
}
let defaultFiles = [
  "index.html",
  "index.htm",
  "index.js"
];
function checkProxies (reqPath) {
  let proxyRequest = false;
  Object.keys(proxies).forEach(proxy => {
    if (reqPath.startsWith(proxy)) {
      proxyRequest = {};
      proxyRequest.options = {};
      proxyRequest.url = proxy;
      Object.assign(proxyRequest.options, proxies[proxy]);
      proxyRequest.options.path = reqPath.substring(proxy.length);
      return proxyRequest;
    }
  });
  return proxyRequest;
}
function setFileInfo (req, res, basePath) {
   let serveFile=true;
   let headers=req.headers;
   let fullPath="", suffix="", queryString="", contentType="",dirPath="",etag="";
   if (!headers['accept-encoding']) headers['accept-encoding'] = '';  // gzip, etc. 
   let reload=false;
   let thisBasePath=basePath;
   let proxyOptions="";
   let audioVisual = false;
console.log("req.url: " + req.url);
   if (proxies) {
     let proxyRequest = checkProxies(req.url);
     if (proxyRequest) {
       proxyOptions = proxyRequest.options;
       proxyOptions.url = req.url = proxyRequest.url;
     //  proxyOptions.connectionArray = connectionArray;
       achieve_proxy = _this.loadModule('achieve-proxy');
     } else {
       // console.log("proxyRequest not true: " + proxyRequest);
     }
   }
   let pathObj = url.parse(req.url,true);
   let uncheckedPath = pathObj.pathname;
   // If undefined, noSuchFile in FileInfo object is set to true.
   if (uncheckedPath === undefined) return new FileInfo(thisBasePath,req.url,fullPath,dirPath,suffix,headers,contentType,queryString,false,false,true,reload,etag,audioVisual,proxyOptions);
   // Check to see if the ROOT directory is used, and if so; whether it still exists
 //  if (rootDir && uncheckedPath.lastIndexOf("/") == 0) thisBasePath = rootPath;
   // checkPath returns path request after performing various checks, (See checkPath() for details.)
   let checkedPath = checkPath(thisBasePath,uncheckedPath);
   if (checkedPath.action == "noSuchFile") return new FileInfo(thisBasePath,req.url,checkedPath.filePath,dirPath,suffix,headers,contentType,queryString,false,false,true,reload,etag,audioVisual,proxyOptions);
   // If null, redirect in FileInfo object is set to true. (Needs redirect to add trailing slash.)
   if (checkedPath.action == "redirect") return new FileInfo(thisBasePath,req.url,fullPath,dirPath,suffix,headers,contentType,queryString,false,true,false,reload,etag,audioVisual,proxyOptions);
   let urlArray = req.url.split("?");
   let currentPath = checkedPath.filePath;
   queryString = urlArray[1] || ""; // without '?'
   suffix = path.extname(currentPath).substring(1) || "";
   fullPath = path.join(thisBasePath,currentPath);
   dirPath = path.dirname(fullPath);
   if (suffix.length == 0) {
	 // Requests for JavaScript files without .js suffix are executed rather than served.
	 if (fs.existsSync(fullPath+".js")) {
	   suffix = "servlet"; // This special app suffix does not indicate MIME type.
	   currentPath += ".js";
	   fullPath += ".js";
	   serveFile=false;
     } else {
	   // If file exists with no suffix, attempt to serve it as text.
	   suffix = "txt";
     }
   }
   // Get MIME type.
   contentType = mimeList[suffix];
   // 415 Unsupported Media type is supported above.
   // Remove or conditionalize the following undefined check to make it work
   // This is here because it feels less confusing (new students) - but I want to rethink that
   if (contentType === undefined) {
     contentType = avMimeList[suffix];
     if (contentType === undefined) {
       contentType = "text/plain";
     } else {
       audioVisual=true;
       serveFile=false;
     }
   }
   if (serveFile) {
     // For browser caching support
     if (bCaching) {
       var rawVal = parseInt(Math.floor(checkedPath.stats.mtimeMs) + etagString);
       etag = '"' + Base64.fromNumber(rawVal) + '"';
     } else {
       etag='';
     }
     // For compression
     if (compress && (contentType.indexOf("text") == 0 || contentType.indexOf("application") == 0)) {
       let enc = getEncoding(req);
       if (enc.check) {
         let ccPath = checkCPath(fullPath,enc.ext,checkedPath.stats.mtimeMs);
         currentPath += enc.ext;
         res.setHeader("Content-Encoding",enc.contentEncoding);
       }
     }
   }
   return new FileInfo(thisBasePath,currentPath,fullPath,dirPath,suffix,headers,contentType,queryString,serveFile,false,false,checkedPath.reload,etag,audioVisual,proxyOptions);
}
function checkCPath (path,ext,oAge) {
  try {
    if (fs.existsSync(path+ext)) {
      let cstats = fs.statSync(path+ext);
      if (oAge > cstats.mtimeMs) {
        if (ext == ".gz") {
          fs.writeFileSync(path+ext,zlib.gzipSync(fs.readFileSync(path)));
        } else if (ext == ".zl") {
          fs.writeFileSync(path+ext,zlib.deflateSync(fs.readFileSync(path)));
        }
      }
    } else {
      if (ext == ".gz") {
        fs.writeFileSync(path+ext,zlib.gzipSync(fs.readFileSync(path)));
      } else if (ext == ".zl") {
        fs.writeFileSync(path+ext,zlib.deflateSync(fs.readFileSync(path)));
      }
    }
  } catch (err) {
    console.log(path + "  Compression failed.\n" + err);
    return false;
  }
}
function encodeData (check,contentEncoding,ext) {
  this.check = check;
  this.contentEncoding = contentEncoding;
  this.ext = ext;
}
function getEncoding (req) {
  let acceptEncoding = req.headers['accept-encoding'];
  if (acceptEncoding === undefined) {
    return "";
  } else {
    let aeList = acceptEncoding.split(",");
    for (let adItem of aeList) {
      if (adItem == "gzip") {
        return new encodeData(true,"gzip",".gz");
      } else if (adItem == "deflate") {
        return new encodeData(true,"deflate",".zl");
      } else {
        return new encodeData(false);
      }
    }
  }
}
function nodeVersion () {
  var result="";
  var temp = process.versions.node.split('.');
  for (var i=0; i<temp.length; i++) result += temp[i];
  return result;
}
function display (fi) {
  console.log("\nFile Info: " + reqCount++);
  var propValue;
  for(var propName in fi) {
    propValue = fi[propName];
    console.log("  " + propName,propValue);
  }
}
function Account (account,start,code,reason) {
  this.account = account;
  this.start = start;
  this.code = code;
  this.reason = reason;
}
// getAccount() is called only if JavaScript is to run on the server
// It loads the JavaScript file and creates a new Account object to provide that information or error information.
function getAccount (res,fileInfo) {
	let startPage = fileInfo.fullPath;
	let accountRoot = null;  // handle to loaded JavaScript page.
	let accountInfo; // for the new Account object
	let code = 200;  // default
	let reason;  // reason for error
	// Redundant check. Was also checked in setFileInfo()
	if (!fs.existsSync(startPage)) {
	  code = 404;
	  reason = startPage + " not found.";
	  accountInfo = new Account(null,startPage,code,reason);
	  return accountInfo;
    }
	try {
	  // Load the page and get its handle.
    if (fileInfo.reload) delete require.cache[require.resolve(startPage)];
	  accountRoot = require(startPage);
	  // Make sure that the required servlet(context) function exists in the loaded file.
	  // This is how this system automatically runs code in the newly loaded file. 
	  if (typeof accountRoot.servlet !== 'function') {
		  code = 500;
		  reason = startPage + " does not have a valid servlet() function.";
      delete require.cache[require.resolve(startPage)];
	  }
	} catch (err) {
     code = 500;
	   reason = "Failed to load module: " + rtErrorMsg(err);
	   accountRoot = null;
	}
  accountInfo = new Account(accountRoot,startPage,code,reason);
	return accountInfo;
}
// startObject's init() method runs the code that was loaded by getAccount()
// It will get parameter values from the request and call the loaded application's init() method.
function startObject (req,res,fileInfo) {
  this.req = req;
  this.res = res;
  this.fileInfo = fileInfo;
  this.load = load;
  // this.init() is called to extract data from request, run the application, and send response
  this.init = function () {
	let request = this.req;
	let response = this.res;
  let goodPath = false;
	let fsapp = this.fsapp;
  let fileInfo = this.fileInfo;
  let myAppPath = this.fileInfo.fullPath;
	let shortPath = this.fileInfo.path;
	let reload = this.fileInfo.reload;
  let load = this.load;
	let contentType = this.fileInfo.contentType;
    let myApp;
	// Load the application file if it exists.
  if (fs.existsSync(myAppPath)) {
	  if (reload) {
		  delete require.cache[require.resolve(myAppPath)];
		  moduleLoadTimes[myAppPath] = fs.statSync(myAppPath).mtimeMs; // new Date().getTime();
	  }
    myApp = require(myAppPath);
	  goodPath = true;
  }
	// This service loads the application file and calls exports.servlet(context)
    if (goodPath && typeof myApp.servlet == 'function') {
	  // Extract data sent from the browser for POST or GET
	  let queryData="";
    let wmsg;
    let content;
    response.setHeader('server', version);
    response.setHeader('Content-Type','text/plain');

        if (this.req.method == "POST") {
	      this.req.on('data', function(data) {
			try {
              queryData += data;
              if(queryData.length > 1e6) {
                queryData = "";
              }
			} catch (err) {
		      console.log("Error processing data: " + err.stack);
		    }
          });
          this.req.on('end', function() {
			try {
        request.post = querystring.parse(queryData);
        let boundLoader = load.bind({request:request,response:response,dirPath:fileInfo.dirPath});
        // This is where the application code is "called"
        context = new Context(request,response,request.post,fileInfo.dirPath,boundLoader,fileInfo.proxyOptions,proxies,achieve_proxy);
        let content = myApp.servlet(context);
        if (response.finished || context.allowAsync) {
          console.log("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
        } else if (content === undefined || content === null) {
          wmsg="WARNING: Return value from servlet " + fileInfo.path + " is " + content + ".";
          response.statusCode=500;
			    response.write(wmsg);
          response.end();
          console.log(wmsg);
          return;
        }
          response.statusCode=200;
			    response.write(content,'binary');
          response.end(null,'binary');
		    } catch (err) {
          if (response.finished || context.allowAsync) {
          console.log("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
          }
          wmsg="WARNING: Return value from servlet " + fileInfo.path + " is " + content + ". " + rtErrorMsg(err);
          console.log(wmsg);
          wmsg="post Return type from servlet is " + typeof content + ". " + rtErrorMsg(err);
          response.statusCode=500;
			    response.write(wmsg);
          response.end();
          console.log(wmsg);
		  	}
	      });
        } else if (this.req.method == "GET") {
          let context;
		  try {
        request.get =  querystring.parse(fileInfo.queryString);
		  	let boundLoader = load.bind({request:request,response:response,dirPath:fileInfo.dirPath});
        // This is where the application code is "called"
        context = new Context(request,response,request.get,fileInfo.dirPath,boundLoader,fileInfo.proxyOptions,proxies,achieve_proxy);
        let content = myApp.servlet(context);
        if (response.finished || context.allowAsync) {
          console.log("INFO: GET " + fileInfo.path + " session ended or will end by application.");
          return;
        }
        response.statusCode=200;
			  response.write(content);
        response.end();
		  } catch (err) {
        if (response.finished || context.allowAsync) {
          console.log("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
        }
        wmsg="get Return type from servlet is " + typeof content + ". " + rtErrorMsg(err);
        response.statusCode=500;
        response.end(wmsg);
        console.log(wmsg);
		  }
        } else if (this.req.method == "HEAD") {
          response.statusCode = 200;
          response.setHeader('server',version);
          if (bCaching) response.setHeader('etag',fileInfo.etag);
          response.setHeader('content-type', fileInfo.contentType);
          response.end();
        } else if (this.req.method == "OPTIONS") {
          console.log("OPTIONS REQUEST: " + this.req);
          response.statusCode = 204;
          response.setHeader('access-control-allow-headers', '*');
          response.setHeader('access-control-allow-origin', "*");
          response.setHeader('access-control-max-age', 86400);
          response.setHeader('date', new Date());
          response.setHeader('allow', "GET, HEAD, POST, OPTIONS");
          response.setHeader('server', version);
          response.end();
        } else {
          response.statusCode = 501;
          console.log(this.req.method + " request method is not yet supported on the server: " + version);
          response.end(this.req.method + " request method is not yet supported on the server: " + version);
        }
    } else if (goodPath) {
	    response.write("No .servlet function in file: " + myAppPath);
	    response.end();
    } else {
	    response.write(myAppPath + " not found.");
	    response.end();
    }
  };
}
// rtErrorMsg() extracts useful information from the error stack
// when a runtime error occurs in the application code.
// The message can be written to the server's console and it is also
// returned so that it can be be sent to browser and displayed in its console.
// (Display in browser console requires cooperating AJAX handling in the browser
//    when http response status code != 200; console.error(..responseText))
function rtErrorMsg (err,shortPath="",code=500) {
  err.stack = err.stack.replace(/\\/g,"/");
  var part1 = err.stack.substring(0,err.stack.indexOf('\n'));
  var part2 = err.stack.substring(part1.length);
  part2 = part2.substring(0,part2.indexOf(')'));
  part2 = part2.substring(part2.lastIndexOf('/')+1);
  var reason = "Runtime error: " + part1 + " " + part2;
  console.log("Error running servlet: " + reason);
  return reason;
}
// 537().init() sets up event driven streaming file serves
// The final event also deletes the loaded file reference from the Node.js cache
function ServeFile (req,res,fileInfo) {
  this.res = res;
  this.req = req;
  this.fp = fileInfo.basePath+fileInfo.path;
  this.contentType = fileInfo.contentType;
  this.init = function () {
	let response = this.res;
	let filePath = this.fp;
  let request = this.req;
  
  let ext="";

  if(bCaching && validCached(fileInfo,response)) return;
   
   res.setHeader('content-type', fileInfo.contentType);
   res.setHeader('server', version);
   if (bCaching) res.setHeader('etag', fileInfo.etag);
   res.statusCode = 200;
   
   let readStream = fs.createReadStream(filePath)
   .on ('error', function (err) {
     console.log(err.message);
     res.setHeader('content-type', 'text/plain');
     res.statusCode = 500;
     res.end(err.message);
   });
  readStream.pipe(res);
  };
}
// Not implemented - input object to be sent to JavaScript application
function input (request,fs,queryPath,queryData,parameters) {
  this.request = request;
  this.parameters = parameters;
  this.queryData = queryData;
  this.fs = fs;
  this.queryPath = queryPath;
  this.datetime = dt;
}
// Not implemented - output object to be sent to JavaScript application
function output (response,ext,charset,mimeType) {
  this.response = response;
  this.ext = ext;
  this.charset = charset;
  this.mimeType = mimeType;
}
// To provide servlet characteristics to locally installed node modules
// including achieve itself
exports.loadModule = function (moduleName) {
  let fullPath;
  let localModulePath = require.main.paths[0];
  try {
    fullPath = path.normalize(localModulePath +'/'+moduleName+'/'+moduleName+'.js');
    stats = fs.statSync(fullPath);
	  if (moduleLoadTimes[fullPath] === undefined || moduleLoadTimes[fullPath] < stats.mtimeMs) {
	    delete require.cache[require.resolve(fullPath)];
      moduleLoadTimes[fullPath] = stats.mtimeMs; // new Date().getTime();
	  }
    return require(moduleName);
  } catch (err) {
    console.log("loadModule: " + rtErrorMsg(err));
  }
}
let load = function (filePath) {
  let dirname=this.dirPath;
  let fullPath = path.join(dirname,filePath+".js");
  try {
    stats = fs.statSync(fullPath);
	  if (moduleLoadTimes[fullPath] === undefined || moduleLoadTimes[fullPath] < stats.mtimeMs) {
	    delete require.cache[require.resolve(fullPath)];
      moduleLoadTimes[fullPath] = stats.mtimeMs;
	  }
    return require(fullPath);
  } catch (err) {
    this.response.writeHead(500, {'Content-Type': 'text/plain;'});
    reason = "load: " + rtErrorMsg(err);
	  console.log(reason);
  	this.response.write(reason);
  } 
}
/* Modify this to collect a list of files to preload (JSO) - do preloads when server starts
exports.preload1 = function (loadList) {
  if (loadList.length > 0) {
    loadList = loadList.split(",");
  } else {
    console.log("No files in preload list.");
    return;
  }
  for (let lf of loadList) {
    try {
      require(lf);
    } catch (err) {
      console.log(lf + " failed to load.");
    }
  }
}
// use checkPath() first to get complete file information, including the right baseDir or rootDir
let preload = function (filePath) {
  if (path.extname(filePath) != ".js") filePath = filePath+".js";
  let fullPath = path.join(basePath,filePath);
  try {
    stats = fs.statSync(fullPath);
  	if (moduleLoadTimes[fullPath] === undefined || moduleLoadTimes[fullPath] < stats.mtimeMs) {
	    delete require.cache[require.resolve(fullPath)];
	  }
    moduleLoadTimes[fullPath] = new Date().getTime();
    let temp = require(fullPath);
    console.log("preloaded: " + fullPath);
    return temp;
  } catch (err) {
    var stop1 = err.stack.indexOf(err.message);
	  var stop = err.stack.substring(0,stop1).lastIndexOf('\n');
	  var errDescription = err.stack.substring(basePath.length,stop).replace(/\\/g,"/");
	  reason = "Failed to load module: " + err.message + " \nreason: " + errDescription;
	  console.log(reason);
  } 
}
*/
/*
let blank = {
  init: function () {return "";}
}
*/
function validCached (fileInfo,response) {
  // Browser cache support - not yet implemented
  // Modified for etag instead of last-modified ... UNTESTED!
  // Version 26 has the old tested last-modified version of this function.
  // Change was necessary because .lastModified no longer included in fileInfo.
  
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
  
  /*
    If-None-Match ... send 304 if value matches etag
    If-Match .... send only if etag matches one of the values
  */
  /*
  return values:
     false: 304 has not been returned ... the server process is not completed
     true: 304 has been returned ... the server process is complete
  */
  response.setHeader('etag', fileInfo.etag);
  let inmsp = fileInfo.headers['if-none-match'];
  if (inmsp === undefined) return false;
  let inms = inmsp.split(",");

  for (var i=0; i<inms.length; i++) {
    if (inms == fileInfo.etag) {
      response.statusCode = 304;
      response.end();
      return true;
    }
  }
  return false;
}
Base64 = {
  _Rixits:"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/",
  fromNumber : function(residual) {
    var rixit; // like 'digit', only in some non-decimal radix 
    var result = '';
    while (true) {
      rixit = residual % 64;
      result = this._Rixits.charAt(rixit) + result;
      residual = Math.floor(residual / 64);

      if (residual == 0) break;
    }
    return result;
  }
}
let stream = function(req, res, fileInfo) {
  var fileName = fileInfo.fullPath;
  if(!fileName)
    return res.status(404).send();
 
  fs.stat(fileName, function(err, stats) {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).send();
      }
    }
 
    var start;
    var end;
    var total = 0;
    var contentRange = false;
    var contentLength = 0;
 
    var range = req.headers.range;
    if (range)
    {
      var positions = range.replace(/bytes=/, "").split("-");
      start = parseInt(positions[0], 10);
      total = stats.size;
      end = positions[1] ? parseInt(positions[1], 10) : total - 1;
      var chunksize = (end - start) + 1;
      contentRange = true;
      contentLength = chunksize;
    }
    else
    {
      start = 0;
      end = stats.size;
      contentLength = stats.size;
    }
 
    if(start<=end)
    {
      var responseCode = 200;
      var responseHeader =
      {
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": fileInfo.contentType
      };
      if(contentRange)
      {
        responseCode = 206;
        responseHeader["Content-Range"] = "bytes " + start + "-" + end + "/" + total;
      }
      res.writeHead(responseCode, responseHeader);
      var stream = fs.createReadStream(fileName, { start: start, end: end })
       .on("error", function(err) {
          res.end(err);
        }).on("end", function(err) {
          res.end();
        });
      stream.pipe(res);
    }
    else
    {
      return res.status(403).send();
    }
  });
};

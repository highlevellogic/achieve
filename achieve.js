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
   let shortVersion = require('./package.json').version;
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
function methodNotSupported(req, res) {
    let message =
        req.method +
        " request method is not yet supported on the server: " +
        version;

    res.statusCode = 501;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    console.log(message);
    res.end(message);
}

function handleResolvedResource(req, res, fileInfo, sendBody = true) {
 // display(fileInfo);
   // If request is a directory, it must have a trailing slash (otherwise resources such as css and js won't be loaded).
   if (fileInfo.redirect) {
     var qString = fileInfo.path.split("?");
	   var newUrl = path.posix.join(qString[0].replace(/\\/g,"/"), "/");
     if (qString.length == 2) newUrl = newUrl+"?"+qString[1];
     res.statusCode = 301;
     res.setHeader('Content-Type', 'text/plain');
     res.setHeader('Location', newUrl);
     if (sendBody) {
       res.end('Redirecting to ' + newUrl);
     } else {
       res.end();
     }
   } else if (fileInfo.contentType === undefined) {
     res.statusCode = 415;
     res.setHeader('Content-Type', 'text/plain');
     if (sendBody) {
       res.end('Media type is not supported. Use server.addMimeType() in your application.'); // currently, defaults to text/plain
     } else {
       res.end();
     }
   // Files are served using the serveFile object in this application.
   } else if (fileInfo.serveFile) {
     try {
	   if (fs.existsSync(fileInfo.fullPath)) {
		 if (evaluatePreconditions(req,res,true,fileInfo.etag)) return;
		 new ServeFile(req,res,fileInfo,sendBody).init();
	   } else {
		 reportError(res,fileInfo.fullPath,404,"File not found: " + safeSourceIdentity(fileInfo.fullPath),sendBody);
	   }
	 } catch (err) {
		reportError(res,fileInfo.fullPath,500,"Error attempting to serve " + safeSourceIdentity(fileInfo.fullPath),sendBody);
	 }
   } else if (fileInfo.audioVisual) {
     // Bugs related to streaming video over http2.
     if (false /*this.protocol == "http2.https" */) {
       reportError(res,fileInfo.fullPath,500,"Video streaming not supported on HTTP2.",sendBody);
     } else {
       stream(req,res,fileInfo,sendBody);
     }
   // If file does not exist, return 404 File not found error.
   } else if (fileInfo.noSuchFile) {
	   reportError(res,fileInfo.fullPath,404,"File not found: " + fileInfo.fullPath,sendBody);
   // Otherwise, a JavaScript file should be loaded.
   } else {
	   // Checks and adds JavaScript file.
	   let accountInfo = getAccount(res,fileInfo);
     if (accountInfo.code == 200) {
	     if (evaluatePreconditions(req,res,true)) return;
	     try {
		     // Executes the JavaScript.
		     new startObject(req,res,fileInfo,accountInfo.account,sendBody).init();
	     } catch (err) {}
	   } else {
	     reportError(res,accountInfo.account,accountInfo.code,accountInfo.reason,sendBody);
	   }
   }
}

function handleGet(req, res, basePath, resourceTarget) {
    let fileInfo = setFileInfo(req, res, basePath, resourceTarget);
    return handleResolvedResource(req, res, fileInfo);
}

function handlePost(req, res, basePath, resourceTarget) {
    let fileInfo = setFileInfo(req, res, basePath, resourceTarget);
    return handleResolvedResource(req, res, fileInfo);
}

function handleHead(req, res, basePath, resourceTarget) {
    let fileInfo = setFileInfo(req, res, basePath, resourceTarget);
    return handleResolvedResource(req, res, fileInfo, false);
}

function dispatchMethod(req, res, basePath, resourceTarget) {
    switch (req.method) {
        case "GET":
            return handleGet(req, res, basePath, resourceTarget);

        case "POST":
            return handlePost(req, res, basePath, resourceTarget);

        case "HEAD":
            return handleHead(req, res, basePath, resourceTarget);

        case "PUT":
        case "DELETE":
        case "CONNECT":
        case "OPTIONS":
        case "TRACE":
        case "PATCH":
        default:
            return methodNotSupported(req, res);
    }
}

function validAuthorityTarget(target) {
  try {
    let authority = url.parse("http://" + target);
    let port = authority.port;
    return (
      authority.hostname &&
      port &&
      /^\d+$/.test(port) &&
      Number(port) <= 65535 &&
      authority.auth === null &&
      authority.pathname === "/" &&
      authority.search === null &&
      authority.hash === null
    );
  } catch (err) {
    return false;
  }
}

function requestTarget(req) {
  let rawTarget = req.url;

  if (rawTarget.charAt(0) === "/") {
    if (req.method === "CONNECT") return false;
    return {form:"origin",resourceTarget:rawTarget};
  }

  if (rawTarget === "*") {
    if (req.method !== "OPTIONS") return false;
    return {form:"asterisk"};
  }

  if (req.method === "CONNECT") {
    if (!validAuthorityTarget(rawTarget)) return false;
    return {form:"authority",authority:rawTarget};
  }

  let absoluteTarget;
  try {
    absoluteTarget = url.parse(rawTarget);
  } catch (err) {
    return false;
  }
  if (
    (absoluteTarget.protocol !== "http:" && absoluteTarget.protocol !== "https:") ||
    !absoluteTarget.slashes ||
    !absoluteTarget.host ||
    absoluteTarget.hash
  ) {
    return false;
  }

  return {
    form:"absolute",
    authority:absoluteTarget.host,
    resourceTarget:
      (absoluteTarget.pathname || "/") +
      (absoluteTarget.search || "")
  };
}

function validHostValue(hostValue) {
  if (typeof hostValue !== "string") return false;

  let bracketedHost = hostValue.match(/^\[([^\]]+)\](?::([0-9]*))?$/);
  if (bracketedHost) {
    let address = bracketedHost[1];
    return (
      require("net").isIP(address) === 6 ||
      /^v[0-9A-F]+\.[A-Za-z0-9._~!$&'()*+,;=:-]+$/i.test(address)
    );
  }

  return /^(?:[A-Za-z0-9._~!$&'()*+,;=-]|%[0-9A-F]{2})*(?::[0-9]*)?$/i
    .test(hostValue);
}

function validHttp11Host(req) {
  if (req.httpVersion !== "1.1") return true;

  let hostCount = 0;
  let hostValue;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === "host") {
      hostCount++;
      if (hostCount > 1) return false;
      hostValue = req.rawHeaders[i+1];
    }
  }

  return hostCount === 1 && validHostValue(hostValue);
}

function handleConnectRequests(server,protocol) {
  server.on('connect',function(req,socket) {
    let response = new (require('http').ServerResponse)(req);
    response.assignSocket(socket);
    achieveApp.call({protocol:protocol},req,response);
  });
}

var achieveApp = function (req, res) {
  console.log(req.method);
 try {
   // Get information about the requested file or application.
 //  let urlParsed = url.parse(req.headers.referer, true);
   console.log("url: " + req.url + ", origin: " + req.connection.remoteAddress || req.headers['x-forwarded-for'] || request.socket.remoteAddress || req.connection.socket.remoteAddress);
   let targetInfo = requestTarget(req);
   if (!targetInfo || !validHttp11Host(req)) {
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
   return dispatchMethod(req, res, basePath, targetInfo.resourceTarget);
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
  } else if ((sport<1024 && sport != portDefault) || sport>49151) {
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
  } else if ((sport<1024 && sport!=443) || sport>49151) {
    console.log("https port " + sport + " is outside acceptable range. (1024-49151) Setting port to default.");
    sport=443;
  }
  } catch (err) {
    console.log("Error setting port in slisten(). Setting port to default.")
    sport=443;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  
  server = https.createServer(ioptions, achieveApp.bind({protocol:"https"}));
  handleConnectRequests(server,"https");
  server.listen(sport);
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

  try {
  
  if (port === undefined) {
    port=80;
  } else if (Number.isNaN(port)) {
    console.log(port + " is not a number. Setting port to default.");
    port=80;
  } else if ((port<1024 && port != 80) || port>49151) {
    console.log("Port " + port + " is outside acceptable range. (1024-49151) Setting port to default.");
    port=80;
  }
  } catch (err) {
    console.log("Error setting port in listen(). Setting port to default.")
    port=80;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  
  server = http.createServer(achieveApp.bind({protocol:"http"}));
  handleConnectRequests(server,"http");
  server.listen(port);

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
function reportError (res,account,statusCode,reason,sendBody = true) {
  if (statusCode === undefined) statusCode = 500;
  try {
    delete require.cache[require.resolve(account)];
  } catch (err) {
  } finally {
	  console.log(statusCode + ": " + reason);
    res.statusCode=statusCode;
    res.setHeader('Content-Type','text/plain;charset=utf-8');
    if (sendBody) {
      res.end(reason);
    } else {
      res.end();
    }
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
function hasEntityTagPrecondition (req) {
  return (
    req.headers['if-match'] !== undefined ||
    req.headers['if-none-match'] !== undefined
  );
}
function representationETag (mtimeMs,coding) {
  var rawVal = parseInt(Math.floor(mtimeMs) + etagString);
  return '"' + Base64.fromNumber(rawVal) + '-' + coding + '"';
}
function entityTagList (fieldValue) {
  let result=[];
  let member="";
  let quoted=false;
  for (let character of fieldValue) {
    if (character === '"') quoted=!quoted;
    if (character === "," && !quoted) {
      result.push(member.trim());
      member="";
    } else {
      member+=character;
    }
  }
  result.push(member.trim());
  return result;
}
function entityTag (value) {
  let tag=value;
  let weak=false;
  if (tag.indexOf("W/") === 0) {
    weak=true;
    tag=tag.substring(2);
  }
  if (
    tag.length < 2 ||
    tag.charAt(0) !== '"' ||
    tag.charAt(tag.length-1) !== '"' ||
    tag.substring(1,tag.length-1).indexOf('"') !== -1
  ) return false;
  return {weak:weak,tag:tag};
}
function entityTagFieldMatches (fieldValue,currentETag,weakComparison) {
  if (currentETag === undefined || currentETag === "") return false;
  let current=entityTag(currentETag);
  if (!current) return false;
  for (let member of entityTagList(fieldValue)) {
    let candidate=entityTag(member);
    if (!candidate) continue;
    if (weakComparison) {
      if (candidate.tag === current.tag) return true;
    } else if (!candidate.weak && !current.weak && candidate.tag === current.tag) {
      return true;
    }
  }
  return false;
}
function evaluatePreconditions (req,res,exists,currentETag) {
  let ifMatch=req.headers['if-match'];
  if (ifMatch !== undefined) {
    let ifMatchResult = ifMatch.trim() === "*"
      ? exists
      : entityTagFieldMatches(ifMatch,currentETag,false);
    if (!ifMatchResult) {
      res.statusCode=412;
      res.end();
      return true;
    }
  }

  let ifNoneMatch=req.headers['if-none-match'];
  if (ifNoneMatch !== undefined) {
    let ifNoneMatchResult = ifNoneMatch.trim() === "*"
      ? exists
      : entityTagFieldMatches(ifNoneMatch,currentETag,true);
    if (ifNoneMatchResult) {
      if (req.method === "GET" || req.method === "HEAD") {
        if (currentETag) res.setHeader("ETag",currentETag);
        res.statusCode=304;
      } else {
        res.statusCode=412;
      }
      res.end();
      return true;
    }
  }
  return false;
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
function containedRequestPath (boundaryPath,requestPath) {
  let boundary = path.resolve(boundaryPath);
  let relativeRequestPath = requestPath.replace(/^[/\\]+/, "");
  let candidate = path.resolve(boundary,relativeRequestPath);
  let relativeCandidate = path.relative(boundary,candidate);

  if (
    relativeCandidate === ".." ||
    relativeCandidate.startsWith(".." + path.sep) ||
    path.isAbsolute(relativeCandidate)
  ) {
    return false;
  }

  if (
    /[/\\]$/.test(requestPath) &&
    candidate.charAt(candidate.length-1) != path.sep
  ) {
    candidate += path.sep;
  }

  return candidate;
}
function checkPath (basePath,relativePath) {
  // Build full path.
  let action="";
  if (relativePath.length == 0) relativePath="/";
  let fullPath = containedRequestPath(basePath,relativePath);
  let stats, checkPath;
  let reload=false;

  if (!fullPath) {
    return new PathInfo(relativePath,false,"noSuchFile",stats);
  }

  let rootFullPath;
  if (rootDir) {
    rootFullPath = containedRequestPath(rootPath,relativePath);
  }
  if (rootFullPath && (fs.existsSync(rootFullPath) || fs.existsSync(rootFullPath+".jss") || fs.existsSync(rootFullPath+".js"))) {
    fullPath = rootFullPath;
    relativePath = path.join(relRootPath,relativePath);
  }
    try {
      // Does fullPath exist?
	    stats = fs.statSync(fullPath); 
    } catch (err) {
          
    if (fs.existsSync(fullPath+".jss")) {
	    stats = fs.statSync(fullPath+".jss");
	    if (moduleLoadTimes[fullPath+".jss"] === undefined || moduleLoadTimes[fullPath+".jss"] < stats.mtimeMs) reload = true;
	    return new PathInfo(path.normalize(relativePath+".jss"),reload,"servlet",stats);
	  }
    if (fs.existsSync(fullPath+".js")) {
	    stats = fs.statSync(fullPath+".js");
	    if (moduleLoadTimes[fullPath+".js"] === undefined || moduleLoadTimes[fullPath+".js"] < stats.mtimeMs) reload = true;
	    return new PathInfo(path.normalize(relativePath+".js"),reload,"servlet",stats);
	  }
    return new PathInfo(path.normalize(relativePath),false,"noSuchFile",stats);
    }
  // If fullPath points to a file, return the relative path.
  if (stats.isFile()) {
    if (path.extname(fullPath).toLowerCase() == ".jss") {
      if (moduleLoadTimes[fullPath] === undefined || moduleLoadTimes[fullPath] < stats.mtimeMs) reload = true;
      return new PathInfo(path.normalize(relativePath),reload,"servlet",stats);
    }
    return new PathInfo(path.normalize(relativePath),true,"serveFile",stats);
  }
  // If fullPath points to a directory:
  if (stats.isDirectory()) {
	// directory requests without trailing '/' are redirected with '/' added
    if (fullPath.charAt(fullPath.length-1) != path.sep) return new PathInfo(path.normalize(relativePath),false,"redirect",stats);
	  // Check for default files like index.html and index.js
	  for (let df of defaultFiles) {
      checkPath = path.join(fullPath,df);
	    if (fs.existsSync(checkPath)) {
		    if (df == "index.jss" || df == "index.js") {
		  	  stats = fs.statSync(checkPath);
			    if (moduleLoadTimes[checkPath] === undefined || moduleLoadTimes[checkPath] < stats.mtimeMs) reload = true;
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
  "index.jss",
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
function setFileInfo (req, res, basePath, requestUrl) {
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
     let proxyRequest = checkProxies(requestUrl);
     if (proxyRequest) {
       proxyOptions = proxyRequest.options;
       proxyOptions.url = requestUrl = proxyRequest.url;
     //  proxyOptions.connectionArray = connectionArray;
       achieve_proxy = _this.loadModule('achieve-proxy');
     } else {
       // console.log("proxyRequest not true: " + proxyRequest);
     }
   }
   let pathObj = url.parse(requestUrl,true);
   let uncheckedPath = pathObj.pathname;
   // If undefined, noSuchFile in FileInfo object is set to true.
   if (uncheckedPath === undefined) return new FileInfo(thisBasePath,requestUrl,fullPath,dirPath,suffix,headers,contentType,queryString,false,false,true,reload,etag,audioVisual,proxyOptions);
   // Check to see if the ROOT directory is used, and if so; whether it still exists
 //  if (rootDir && uncheckedPath.lastIndexOf("/") == 0) thisBasePath = rootPath;
   // checkPath returns path request after performing various checks, (See checkPath() for details.)
   let checkedPath = checkPath(thisBasePath,uncheckedPath);
   if (checkedPath.action == "noSuchFile") return new FileInfo(thisBasePath,requestUrl,checkedPath.filePath,dirPath,suffix,headers,contentType,queryString,false,false,true,reload,etag,audioVisual,proxyOptions);
   // If null, redirect in FileInfo object is set to true. (Needs redirect to add trailing slash.)
   if (checkedPath.action == "redirect") return new FileInfo(thisBasePath,requestUrl,fullPath,dirPath,suffix,headers,contentType,queryString,false,true,false,reload,etag,audioVisual,proxyOptions);
   let urlArray = requestUrl.split("?");
   let currentPath = checkedPath.filePath;
   queryString = urlArray[1] || ""; // without '?'
   suffix = path.extname(currentPath).substring(1) || "";
   fullPath = path.join(thisBasePath,currentPath);
   dirPath = path.dirname(fullPath);
   if (checkedPath.action === "servlet") {
	 suffix = "servlet"; // This special app suffix does not indicate MIME type.
	 serveFile=false;
   } else if (suffix.length == 0) {
	   // If file exists with no suffix, attempt to serve it as text.
	   suffix = "txt";
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
     let etagCoding="i";
     // For compression
     if (compress && (contentType.indexOf("text") == 0 || contentType.indexOf("application") == 0)) {
       res.setHeader("Vary","Accept-Encoding");
       let enc = getEncoding(req);
       if (enc.check) {
         let ccPath = checkCPath(fullPath,enc.ext,checkedPath.stats.mtimeMs);
         if (ccPath !== false) {
           currentPath += enc.ext;
           res.setHeader("Content-Encoding",enc.contentEncoding);
           etagCoding = enc.contentEncoding == "gzip" ? "g" : "d";
         }
       }
     }
     if (bCaching || hasEntityTagPrecondition(req)) {
       etag = representationETag(checkedPath.stats.mtimeMs,etagCoding);
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
	let loadedMtime;
	// Redundant check. Was also checked in setFileInfo()
	if (!fs.existsSync(startPage)) {
	  code = 404;
	  reason = safeSourceIdentity(startPage) + " not found.";
	  accountInfo = new Account(null,startPage,code,reason);
	  return accountInfo;
    }
	try {
	  // Load the page and get its handle.
    if (fileInfo.reload) {
      loadedMtime = fs.statSync(startPage).mtimeMs;
      delete require.cache[require.resolve(startPage)];
    }
	  accountRoot = require(startPage);
	  // Make sure that the required servlet(context) function exists in the loaded file.
	  // This is how this system automatically runs code in the newly loaded file. 
	  if (typeof accountRoot.servlet !== 'function') {
		  code = 500;
		  reason = safeSourceIdentity(startPage) + " does not have a valid servlet() function.";
      delete require.cache[require.resolve(startPage)];
	  } else if (fileInfo.reload) {
      moduleLoadTimes[startPage] = loadedMtime;
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
function startObject (req,res,fileInfo,myApp,sendBody = true) {
  this.req = req;
  this.res = res;
  this.fileInfo = fileInfo;
  this.myApp = myApp;
  this.sendBody = sendBody;
  this.load = load;
  // this.init() is called to extract data from request, run the application, and send response
  this.init = function () {
	let request = this.req;
	let response = this.res;
	let fsapp = this.fsapp;
  let fileInfo = this.fileInfo;
	let shortPath = this.fileInfo.path;
  let load = this.load;
	let contentType = this.fileInfo.contentType;
    let myApp = this.myApp;
    let sendBody = this.sendBody;
	// This service loads the application file and calls exports.servlet(context)
	  // Extract data sent from the browser for POST or GET
	  let queryData="";
    let wmsg;
    let content;
    response.setHeader('server', version);
    response.setHeader('Content-Type','text/plain');

        if (this.req.method == "POST") {
          console.log("using POST");
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
			let context;
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
          if (response.headersSent) {
            wmsg=rtErrorMsg(err);
            console.log(wmsg);
            if (!response.writableEnded && !response.destroyed) {
              response.destroy();
            }
            return;
          }
          if (response.finished || (context && context.allowAsync)) {
          console.log("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
          }
          wmsg=rtErrorMsg(err);
          response.statusCode=500;
			    response.write(wmsg);
          response.end();
          console.log(wmsg);
		  	}
	      });
        } else if (
          this.req.method == "GET" ||
          this.req.method == "HEAD"
        ) {
          console.log("using GET");
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
			  if (sendBody) {
          response.write(content);
        }
        response.end();
		  } catch (err) {
        if (response.headersSent) {
          wmsg=rtErrorMsg(err);
          console.log(wmsg);
          if (!response.writableEnded && !response.destroyed) {
            response.destroy();
          }
          return;
        }
        if (response.finished || (context && context.allowAsync)) {
          console.log("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
        }
        wmsg=rtErrorMsg(err);
        response.statusCode=500;
        response.end(wmsg);
        console.log(wmsg);
		  }
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
  };
}
// rtErrorMsg() extracts useful information from the error stack
// when a runtime error occurs in the application code.
// The message can be written to the server's console and it is also
// returned so that it can be be sent to browser and displayed in its console.
// (Display in browser console requires cooperating AJAX handling in the browser
//    when http response status code != 200; console.error(..responseText))
function safeSourceIdentity (sourcePath) {
  var source = sourcePath;
  if (source.toLowerCase().indexOf("file:///") === 0) {
    source = source.substring(7);
    try {
      source = decodeURIComponent(source);
    } catch (decodeError) {
    }
    if (/^\/[A-Za-z]:\//.test(source)) source = source.substring(1);
  }

  source = source.replace(/\\/g,"/");
  var location = "";
  var locationMatch = source.match(/(:\d+(?::\d+)?)$/);
  if (locationMatch) {
    location = locationMatch[1];
    source = source.substring(0,source.length-location.length);
  }

  var approvedRoots = [basePath];
  if (rootDir && rootPath !== basePath) approvedRoots.push(rootPath);
  for (var root of approvedRoots) {
    if (typeof root !== "string" || root.length === 0) continue;
    var normalizedRoot = root.replace(/\\/g,"/").replace(/\/$/,"");
    var compareSource = source;
    var compareRoot = normalizedRoot;
    if (/^[A-Za-z]:\//.test(source) || source.indexOf("//") === 0) {
      compareSource = source.toLowerCase();
      compareRoot = normalizedRoot.toLowerCase();
    }
    if (
      compareSource === compareRoot ||
      compareSource.indexOf(compareRoot + "/") === 0
    ) {
      var relativeSource = source.substring(normalizedRoot.length).replace(/^\/+/,"");
      if (
        relativeSource.length > 0 &&
        relativeSource.split("/").indexOf("..") === -1
      ) {
        return relativeSource + location;
      }
    }
  }

  var pathParts = source.split("/");
  var basename = pathParts[pathParts.length-1];
  if (!basename || basename === "." || basename === "..") return "[path]";
  return basename + location;
}

function replaceAbsoluteSourcePaths (message) {
  var result = message;
  result = result.replace(/file:\/\/\/[^'")\r\n]+/gi,function(sourcePath) {
    return safeSourceIdentity(sourcePath);
  });
  result = result.replace(/[A-Za-z]:[\\\/][^'")\r\n]+/g,function(sourcePath) {
    return safeSourceIdentity(sourcePath);
  });
  result = result.replace(/(?:\\\\|\/\/)[^'")\r\n]+/g,function(sourcePath) {
    return safeSourceIdentity(sourcePath);
  });
  result = result.replace(/(^|[\s'("=,:])(\/[^\/'")\r\n][^'")\r\n]*)/g,function(match,prefix,sourcePath) {
    return prefix + safeSourceIdentity(sourcePath);
  });
  return result;
}

function sanitizeDeveloperErrorText (message) {
  var result = replaceAbsoluteSourcePaths(message);
  result = result.replace(/\b(?:node:)?internal\/[^\s)]+/g,"");
  result = result.replace(/\b(?:loader|vm):\d+:\d+\b/g,"");
  result = result.replace(/\bachieve\.js:\d+(?::\d+)?\b/gi,"");
  result = replaceAbsoluteSourcePaths(result);
  return result.trim();
}

function runtimeFunctionName (functionName) {
  var name = functionName.trim();
  if (name.indexOf("Object.") === 0) name = name.substring(7);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return "";
  return name;
}

function isInternalRuntimeSource (sourcePath) {
  var source = sourcePath.replace(/\\/g,"/").toLowerCase();
  return (
    source.indexOf("node:internal/") === 0 ||
    source.indexOf("internal/") === 0 ||
    source.indexOf("loader:") === 0 ||
    source.indexOf("vm:") === 0 ||
    source === "native" ||
    /(^|\/)achieve\.js:\d+:\d+$/.test(source)
  );
}

function runtimeStackFrame (stackLine) {
  var line = stackLine.trim();
  if (line.indexOf("at ") !== 0) return "";

  var frame = line.substring(3).trim();
  var functionName = "";
  var sourcePath = frame;
  var frameMatch = frame.match(/^([^()]+) \(([^()]+)\)$/);
  if (frameMatch) {
    functionName = runtimeFunctionName(frameMatch[1]);
    sourcePath = frameMatch[2];
  }

  if (!/[^\s]:\d+:\d+$/.test(sourcePath)) return "";
  if (isInternalRuntimeSource(sourcePath)) return "";

  var sourceIdentity = safeSourceIdentity(sourcePath);
  if (sourceIdentity === "[path]") return "";
  return sourceIdentity;
}

function syntaxStackReason (stack) {
  var stackLines = stack.split('\n');
  var sourcePath = stackLines[0].trim();
  if (!/:\d+(?::\d+)?$/.test(sourcePath)) return "";

  var lowerSourcePath = sourcePath.toLowerCase();
  if (
    lowerSourcePath.indexOf("node:internal/") === 0 ||
    lowerSourcePath.indexOf("internal/") === 0 ||
    lowerSourcePath.indexOf("loader:") === 0 ||
    lowerSourcePath.indexOf("vm:") === 0 ||
    /(^|[\\/])achieve\.js:\d+(?::\d+)?$/.test(lowerSourcePath)
  ) return "";

  var headline = "";
  for (var stackLine of stackLines) {
    var candidate = stackLine.trim();
    if (/^SyntaxError(?:\s*:|$)/.test(candidate)) {
      headline = sanitizeDeveloperErrorText(candidate);
      break;
    }
  }
  if (!headline) return "";

  var sourceIdentity = safeSourceIdentity(sourcePath);
  if (sourceIdentity === "[path]") return headline;
  return headline + " " + sourceIdentity;
}

function rtErrorMsg (err,shortPath="",code=500) {
  var stack;
  if (err !== null && (typeof err === "object" || typeof err === "function")) {
    try {
      if (typeof err.stack === "string") stack = err.stack;
    } catch (stackError) {
    }
  }

  if (stack !== undefined) {
    var normalizedStack = stack.replace(/\\/g,"/");
    var syntaxReason = syntaxStackReason(normalizedStack);
    if (syntaxReason) return syntaxReason;

    var firstLineEnd = normalizedStack.indexOf('\n');
    if (firstLineEnd === -1) return sanitizeDeveloperErrorText(normalizedStack);

    var part1 = normalizedStack.substring(0,firstLineEnd);
    if (/^[A-Za-z_$][A-Za-z0-9_$]*Error:/.test(part1) || /^Error:/.test(part1)) {
      var headline = sanitizeDeveloperErrorText(part1);
      var stackLines = normalizedStack.substring(firstLineEnd+1).split('\n');
      for (var stackLine of stackLines) {
        var usefulFrame = runtimeStackFrame(stackLine);
        if (usefulFrame) return headline + " " + usefulFrame;
      }
      if (headline.length > 0) return headline;
    }

    var part2 = normalizedStack.substring(part1.length);
    var closingParenthesis = part2.indexOf(')');
    if (closingParenthesis !== -1) {
      part2 = part2.substring(0,closingParenthesis);
      var openingParenthesis = part2.lastIndexOf('(');
      if (openingParenthesis !== -1) {
        part2 = safeSourceIdentity(part2.substring(openingParenthesis+1));
      } else {
        part2 = part2.substring(part2.lastIndexOf('/')+1);
      }
    } else {
      part2 = "";
    }
    var reason = sanitizeDeveloperErrorText((part1 + " " + part2).trim());
    if (reason.length > 0) return reason;
  }

  if (err !== null && (typeof err === "object" || typeof err === "function")) {
    try {
      var errorName = typeof err.name === "string" ? err.name : "";
      var errorMessage = typeof err.message === "string" ? err.message : "";
      if (errorName && errorMessage) return sanitizeDeveloperErrorText(errorName + ": " + errorMessage);
      if (errorName) return sanitizeDeveloperErrorText(errorName);
      if (errorMessage) return sanitizeDeveloperErrorText(errorMessage);
    } catch (errorPropertyError) {
    }
  }

  if (err === null) return "Thrown value: null";
  if (err === undefined) return "Thrown value: undefined";
  if (typeof err === "object") return "Thrown value: [object Object]";
  if (typeof err === "function") return "Thrown value: [function]";
  try {
    return sanitizeDeveloperErrorText("Thrown value: " + String(err));
  } catch (stringError) {
    return "Thrown value: [unprintable]";
  }
}
// 537().init() sets up event driven streaming file serves
// The final event also deletes the loaded file reference from the Node.js cache
function ServeFile (req,res,fileInfo,sendBody = true) {
  this.res = res;
  this.req = req;
  this.fp = fileInfo.basePath+fileInfo.path;
  this.contentType = fileInfo.contentType;
  this.sendBody = sendBody;
  this.init = function () {
	let response = this.res;
	let filePath = this.fp;
  let request = this.req;
  let sendBody = this.sendBody;
  
  let ext="";

   res.setHeader('content-type', fileInfo.contentType);
   res.setHeader('server', version);
   if (fileInfo.etag) res.setHeader('etag', fileInfo.etag);
   res.statusCode = 200;
   if (!sendBody) {
     response.end();
     return;
   }

   let readStream;
   function streamError (err) {
     console.log(err.message);
     if (response.destroyed || response.writableEnded) {
       return;
     }
     if (!response.headersSent) {
       response.setHeader('content-type', 'text/plain;charset=utf-8');
       response.statusCode = 500;
       response.end("Error attempting to serve " + safeSourceIdentity(filePath));
     } else {
       response.destroy();
     }
   }

   try {
     readStream = fs.createReadStream(filePath);
   } catch (err) {
     streamError(err);
     return;
   }

   readStream.on('error',streamError);
   readStream.on('open',function () {
     if (response.destroyed || response.writableEnded) {
       readStream.destroy();
       return;
     }
     readStream.pipe(response);
   });
   response.on('close',function () {
     if (!response.writableEnded) {
       readStream.destroy();
     }
   });
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
  let loadedMtime;
  stats = fs.statSync(fullPath);
	if (moduleLoadTimes[fullPath] === undefined || moduleLoadTimes[fullPath] < stats.mtimeMs) {
    loadedMtime = stats.mtimeMs;
	  delete require.cache[require.resolve(fullPath)];
	}
  let loadedModule = require(fullPath);
  if (loadedMtime !== undefined) moduleLoadTimes[fullPath] = loadedMtime;
  return loadedModule;
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
function parseSingleByteRange(rangeHeader, fileSize) {
  if (rangeHeader === undefined) {
    return { classification: "full" };
  }

  var range = rangeHeader.trim();
  var separator = range.indexOf("=");
  if (separator === -1) {
    return { classification: "malformed" };
  }

  var unit = range.substring(0, separator);
  if (unit.toLowerCase() !== "bytes") {
    return { classification: "unknown-unit" };
  }

  var rangeValue = range.substring(separator + 1);
  if (rangeValue.indexOf(",") !== -1) {
    return { classification: "multiple-ranges" };
  }

  var match = /^(\d*)-(\d*)$/.exec(rangeValue);
  if (!match || (!match[1] && !match[2])) {
    return { classification: "malformed" };
  }

  if (!match[1]) {
    var suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength)) {
      return { classification: "malformed" };
    }
    if (suffixLength === 0 || fileSize === 0) {
      return { classification: "unsatisfiable" };
    }

    var suffixStart = Math.max(fileSize - suffixLength, 0);
    return {
      classification: "partial",
      start: suffixStart,
      end: fileSize - 1,
      contentLength: fileSize - suffixStart
    };
  }

  var start = Number(match[1]);
  if (!Number.isSafeInteger(start)) {
    return { classification: "malformed" };
  }
  if (start >= fileSize) {
    return { classification: "unsatisfiable" };
  }

  var end = fileSize - 1;
  if (match[2]) {
    end = Number(match[2]);
    if (!Number.isSafeInteger(end)) {
      return { classification: "malformed" };
    }
    if (end < start) {
      return { classification: "unsatisfiable" };
    }
    end = Math.min(end, fileSize - 1);
  }

  return {
    classification: "partial",
    start: start,
    end: end,
    contentLength: (end - start) + 1
  };
}
let stream = function(req, res, fileInfo, sendBody = true) {
  var fileName = fileInfo.fullPath;
  var displayedFileName = fileName ? safeSourceIdentity(fileName) : fileName;
  if(!fileName) {
    reportError(res, fileName, 404, "File not found: " + displayedFileName, sendBody);
    return;
  }

  fs.stat(fileName, function(err, stats) {
    if (err) {
      if (err.code === 'ENOENT') {
        reportError(res, fileName, 404, "File not found: " + displayedFileName, sendBody);
        return;
      }
      reportError(
        res,
        fileName,
        500,
        "Error attempting to stream " + displayedFileName + ": " + rtErrorMsg(err),
        sendBody
      );
      return;
    }

    var mediaETag="";
    var evaluateIfRange = (
      req.method === "GET" &&
      req.headers.range !== undefined &&
      req.headers['if-range'] !== undefined
    );
    if (
      bCaching ||
      hasEntityTagPrecondition(req) ||
      evaluateIfRange
    ) {
      mediaETag=representationETag(stats.mtimeMs,"i");
      res.setHeader("ETag",mediaETag);
    }
    if (evaluatePreconditions(req,res,true,mediaETag)) return;

    if (!err && !sendBody) {
      res.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Length": stats.size,
        "Content-Type": fileInfo.contentType
      });
      res.end();
      return;
    }

    var rangeHeader = req.method === "GET" ? req.headers.range : undefined;
    if (
      evaluateIfRange &&
      !entityTagFieldMatches(req.headers['if-range'],mediaETag,false)
    ) {
      rangeHeader=undefined;
    }
    var rangeInfo = parseSingleByteRange(rangeHeader, stats.size);
    if (rangeInfo.classification === "malformed") {
      var message = "Malformed byte Range request.";
      res.writeHead(400, {
        "Content-Type": "text/plain;charset=utf-8",
        "Content-Length": Buffer.byteLength(message, "utf8")
      });
      res.end(message);
      return;
    }
    if (
      rangeInfo.classification === "unsatisfiable" ||
      rangeInfo.classification === "multiple-ranges"
    ) {
      var rangeErrorMessage = rangeInfo.classification === "multiple-ranges"
        ? "Multiple byte ranges are not supported."
        : "Requested byte range is not satisfiable.";
      res.writeHead(416, {
        "Accept-Ranges": "bytes",
        "Content-Range": "bytes */" + stats.size,
        "Content-Type": "text/plain;charset=utf-8",
        "Content-Length": Buffer.byteLength(rangeErrorMessage, "utf8")
      });
      res.end(rangeErrorMessage);
      return;
    }

    var start;
    var end;
    var total = 0;
    var contentRange = false;
    var contentLength = 0;

    if (rangeInfo.classification === "partial")
    {
      start = rangeInfo.start;
      total = stats.size;
      end = rangeInfo.end;
      contentRange = true;
      contentLength = rangeInfo.contentLength;
    }
    else
    {
      contentLength = stats.size;
    }

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
    if (!contentRange && stats.size === 0) {
      res.writeHead(responseCode, responseHeader);
      res.end();
      return;
    }

    var stream;
    try {
      if (contentRange) {
        stream = fs.createReadStream(fileName, { start: start, end: end });
      } else {
        stream = fs.createReadStream(fileName);
      }
    } catch (err) {
      var statusCode = err.code === "ENOENT" ? 404 : 500;
      var reason = statusCode === 404
        ? "File not found: " + displayedFileName
        : "Error attempting to stream " + displayedFileName + ": " + rtErrorMsg(err);
      reportError(res, fileName, statusCode, reason, sendBody);
      return;
    }

    stream.on("error", function(err) {
      if (res.destroyed) {
        return;
      }
      if (!res.headersSent) {
        var statusCode = err.code === "ENOENT" ? 404 : 500;
        var reason = statusCode === 404
          ? "File not found: " + displayedFileName
          : "Error attempting to stream " + displayedFileName + ": " + rtErrorMsg(err);
        reportError(res, fileName, statusCode, reason, sendBody);
      } else {
        console.log("Error streaming " + fileName + ": " + rtErrorMsg(err));
        res.destroy();
      }
    });
    stream.on("open", function() {
      if (res.destroyed) {
        stream.destroy();
        return;
      }
      res.writeHead(responseCode, responseHeader);
      stream.pipe(res);
    });
    res.on("close", function() {
      if (!res.writableEnded) {
        stream.destroy();
      }
    });
  });
};

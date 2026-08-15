// Essential modules. Always load. 
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
// Optional modules. Load only when used.

let http;
let https;
let zlib;
let streamPipeline;
let compressionJobs = new Set();
let compressionTempSequence = 0;
// const avmine = require("./avmine");
// const dt = require('./datetime');
// let flatted = require('flatted');

if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'production';

let moduleLoadTimes = {};
let servletResolutionCache = new Map();
let servletResolutionAliases = new Map();

let mode = "development";
let logging = {
  console: true,
  server: false,
  access: false
};
let loggingConfigurationLocked = false;
let serverInstallationPath = getServerInstallationPath();
let logRoot = path.join(serverInstallationPath,"logs");
let serverLogSink;
let accessLogSink;
let activeServers = new Set();
let shutdownInProgress = false;
let shutdownComplete = false;
let shutdownError;
let shutdownCallbacks = [];

function getServerInstallationPath() {
  if (
    require.main &&
    typeof require.main.filename === "string" &&
    require.main.filename.length > 0
  ) {
    return path.dirname(path.resolve(require.main.filename));
  }
  return path.resolve(process.cwd());
}

function ensureLoggingConfigurable(functionName) {
  if (loggingConfigurationLocked) {
    throw new Error(functionName + "() must be called before listen().");
  }
}

exports.setMode = function (newMode) {
  ensureLoggingConfigurable("setMode");
  if (newMode !== "development" && newMode !== "production") {
    throw new TypeError('setMode() requires "development" or "production".');
  }
  mode = newMode;
}

exports.setLogging = function (...destinations) {
  ensureLoggingConfigurable("setLogging");
  if (destinations.length === 0) {
    throw new TypeError("setLogging() requires at least one argument.");
  }

  if (destinations.length === 1 && typeof destinations[0] === "boolean") {
    let enabled = destinations[0];
    logging = {
      console: enabled,
      server: enabled,
      access: enabled
    };
    return;
  }

  if (destinations.some(destination => typeof destination !== "string")) {
    throw new TypeError("setLogging() accepts one boolean or logging destination names.");
  }

  let selected = {
    console: false,
    server: false,
    access: false
  };
  for (let destination of destinations) {
    if (!Object.prototype.hasOwnProperty.call(selected,destination)) {
      throw new RangeError("Unknown logging destination: " + destination);
    }
    selected[destination] = true;
  }
  logging = selected;
}

exports.setLogPath = function (newLogRoot) {
  ensureLoggingConfigurable("setLogPath");
  if (typeof newLogRoot !== "string" || newLogRoot.trim().length === 0) {
    throw new TypeError("setLogPath() requires a non-empty path string.");
  }
  let candidate = newLogRoot.trim();
  logRoot = path.isAbsolute(candidate)
    ? path.normalize(candidate)
    : path.resolve(serverInstallationPath,candidate);
}

function padNumber(value,width = 2) {
  return String(value).padStart(width,"0");
}

function localDateKey(date = new Date()) {
  return date.getFullYear() + "-" +
    padNumber(date.getMonth() + 1) + "-" +
    padNumber(date.getDate());
}

function localTimestamp(date = new Date()) {
  let offsetMinutes = -date.getTimezoneOffset();
  let sign = offsetMinutes >= 0 ? "+" : "-";
  let absoluteOffset = Math.abs(offsetMinutes);
  return localDateKey(date) + "T" +
    padNumber(date.getHours()) + ":" +
    padNumber(date.getMinutes()) + ":" +
    padNumber(date.getSeconds()) + "." +
    padNumber(date.getMilliseconds(),3) +
    sign +
    padNumber(Math.floor(absoluteOffset / 60)) + ":" +
    padNumber(absoluteOffset % 60);
}

function createLogSink(category) {
  let stream;
  let streams = new Set();
  let dateKey;
  let failed = false;
  let ended = false;
  let failureError;
  let errorReported = false;

  function reportFailure(err) {
    if (errorReported) return;
    errorReported = true;
    console.error(
      "Achieve " + category + " logging failed: " +
      (err && err.message ? err.message : String(err))
    );
  }

  function disable(err) {
    failed = true;
    if (!failureError) failureError = err;
    reportFailure(err);
    for (let ownedStream of streams) {
      if (!ownedStream.destroyed) ownedStream.destroy();
    }
    stream = undefined;
    dateKey = undefined;
  }

  function openStream(nextDateKey) {
    let categoryPath = path.join(logRoot,category);
    let filePath = path.join(categoryPath,nextDateKey + ".log");
    fs.mkdirSync(categoryPath,{recursive:true});
    let fileDescriptor = fs.openSync(filePath,"a");
    let nextStream;
    try {
      nextStream = fs.createWriteStream(filePath,{
        fd:fileDescriptor,
        flags:"a",
        autoClose:true
      });
    } catch (err) {
      fs.closeSync(fileDescriptor);
      throw err;
    }
    streams.add(nextStream);
    nextStream.once("close",function () {
      streams.delete(nextStream);
    });
    nextStream.on("error",function (err) {
      disable(err);
    });
    return nextStream;
  }

  function initialize() {
    if (failed || ended) return false;
    if (stream) return true;
    try {
      dateKey = localDateKey();
      stream = openStream(dateKey);
      return true;
    } catch (err) {
      disable(err);
      return false;
    }
  }

  function write(record) {
    if (failed || ended) return false;
    if (!stream && !initialize()) return false;
    let now = new Date();
    let nextDateKey = localDateKey(now);
    if (nextDateKey !== dateKey) {
      let nextStream;
      try {
        nextStream = openStream(nextDateKey);
      } catch (err) {
        disable(err);
        return false;
      }
      let previousStream = stream;
      stream = nextStream;
      dateKey = nextDateKey;
      previousStream.end();
    }
    try {
      stream.write(localTimestamp(now) + " " + record + "\n");
      return true;
    } catch (err) {
      disable(err);
      return false;
    }
  }

  function close() {
    for (let ownedStream of streams) {
      if (!ownedStream.destroyed) ownedStream.destroy();
    }
    stream = undefined;
    dateKey = undefined;
  }

  function end(callback) {
    callback = typeof callback === "function"
      ? callback
      : function () {};

    if (failed || ended) {
      process.nextTick(callback);
      return;
    }

    ended = true;

    let openStreams = Array.from(streams).filter(function (ownedStream) {
      return !ownedStream.destroyed;
    });

    stream = undefined;
    dateKey = undefined;

    if (openStreams.length === 0) {
      process.nextTick(callback);
      return;
    }

    let remaining = openStreams.length;

    function streamClosed() {
      remaining--;
      if (remaining === 0) {
        callback(failed ? failureError : undefined);
      }
    }

    for (let ownedStream of openStreams) {
      ownedStream.once("close",streamClosed);
      if (!ownedStream.writableEnded) ownedStream.end();
    }
  }

  return {
    initialize:initialize,
    write:write,
    close:close,
    end:end,
    hasFailed:function () { return failed; }
  };
}

function developmentLog(...values) {
  if (mode === "development" && logging.console) console.log(...values);
}

function serverEvent(event,message,err) {
  if (logging.console) {
    if (event === "ERROR") console.error(message);
    else console.log(message);
  }
  if (logging.server && serverLogSink) {
    serverLogSink.write(
      event + " " +
      (err && err.stack ? message + "\n" + err.stack : message)
    );
  }
}

function serverWarning(message) {
  serverEvent("WARN",message);
}

function serverError(message,err) {
  serverEvent("ERROR",message,err);
}

function accessLogValue(value) {
  return '"' +
    String(value)
      .replace(/\\/g,"\\\\")
      .replace(/"/g,'\\"')
      .replace(/[\x00-\x1F\x7F]/g,function (character) {
        return "\\u" +
          character.charCodeAt(0).toString(16).padStart(4,"0");
      }) +
    '"';
}

function createAccessRecorder(req) {
  if (
    !logging.access ||
    !accessLogSink ||
    accessLogSink.hasFailed()
  ) return;

  let started = process.hrtime.bigint();
  let recorded = false;
  let method = req.method || "";
  let requestTarget = req.url || "";
  let remoteAddress =
    req.socket && req.socket.remoteAddress
      ? req.socket.remoteAddress
      : "-";

  return function recordAccess(statusCode,completionState) {
    if (recorded) return;
    recorded = true;

    let elapsedNanoseconds = process.hrtime.bigint() - started;
    let elapsedMilliseconds = Number(elapsedNanoseconds) / 1e6;

    accessLogSink.write(
      "remote=" + accessLogValue(remoteAddress) +
      " method=" + accessLogValue(method) +
      " target=" + accessLogValue(requestTarget) +
      " status=" + statusCode +
      " elapsed=" + elapsedMilliseconds.toFixed(3) + "ms" +
      " state=" + completionState
    );
  };
}

function attachAccessLogging(req,res) {
  let recordAccess = createAccessRecorder(req);
  if (!recordAccess) return;

  res.once("finish",function () {
    recordAccess(res.statusCode,"complete");
  });

  res.once("close",function () {
    recordAccess(res.statusCode,"aborted");
  });
}

function initializeLogging() {
  if (loggingConfigurationLocked) {
    return (
      (!logging.server || (serverLogSink && !serverLogSink.hasFailed())) &&
      (!logging.access || (accessLogSink && !accessLogSink.hasFailed()))
    );
  }
  loggingConfigurationLocked = true;

  if (logging.server) {
    serverLogSink = createLogSink("server");
    if (!serverLogSink.initialize()) {
      console.error("Achieve listener was not started because server logging could not be initialized.");
      return false;
    }
  }

  if (logging.access) {
    accessLogSink = createLogSink("access");
    if (!accessLogSink.initialize()) {
      if (serverLogSink) serverLogSink.close();
      console.error("Achieve listener was not started because access logging could not be initialized.");
      return false;
    }
  }

  return true;
}

function registerListener(server) {
  server.once("listening",function () {
    activeServers.add(server);
  });

  server.once("close",function () {
    activeServers.delete(server);
  });
}

function canStartListener() {
  if (shutdownInProgress || shutdownComplete) {
    serverError("Achieve cannot start a listener after shutdown has begun.");
    return false;
  }

  return true;
}

function firstShutdownError(err) {
  if (err && !shutdownError) shutdownError = err;
}

function closeActiveServers(callback) {
  let servers = Array.from(activeServers);

  if (servers.length === 0) {
    process.nextTick(callback);
    return;
  }

  let remaining = servers.length;

  function serverClosed(err) {
    firstShutdownError(err);
    remaining--;
    if (remaining === 0) callback();
  }

  for (let server of servers) {
    if (!server.listening) {
      server.once("close",function () {
        serverClosed();
      });
      continue;
    }

    try {
      server.close(serverClosed);
    } catch (err) {
      serverClosed(err);
    }
  }
}

function endLogging(callback) {
  let sinks = [];

  if (serverLogSink && !serverLogSink.hasFailed()) {
    sinks.push(serverLogSink);
  }

  if (accessLogSink && !accessLogSink.hasFailed()) {
    sinks.push(accessLogSink);
  }

  if (sinks.length === 0) {
    process.nextTick(callback);
    return;
  }

  let remaining = sinks.length;

  function sinkEnded(err) {
    firstShutdownError(err);
    remaining--;
    if (remaining === 0) callback();
  }

  for (let sink of sinks) {
    sink.end(sinkEnded);
  }
}

function finishShutdown() {
  shutdownComplete = true;
  shutdownInProgress = false;

  let callbacks = shutdownCallbacks;
  shutdownCallbacks = [];

  for (let callback of callbacks) {
    process.nextTick(function () {
      callback(shutdownError);
    });
  }
}

exports.shutdown = function (reason,callback) {
  if (typeof reason === "function") {
    callback = reason;
    reason = "application";
  } else if (reason === undefined) {
    reason = "application";
  }

  if (callback !== undefined && typeof callback !== "function") {
    throw new TypeError("shutdown() callback must be a function.");
  }

  if (callback) {
    if (shutdownComplete) {
      process.nextTick(function () {
        callback(shutdownError);
      });
      return;
    }

    shutdownCallbacks.push(callback);
  }

  if (shutdownInProgress || shutdownComplete) return;

  shutdownInProgress = true;

  let safeReason =
    typeof reason === "string" &&
    /^[A-Za-z0-9._-]+$/.test(reason)
      ? reason
      : "application";

  serverEvent("SHUTDOWN","requested reason=" + safeReason);

  closeActiveServers(function () {
    serverEvent("SHUTDOWN","listeners closed");
    serverEvent("SHUTDOWN","completed");

    endLogging(function () {
      finishShutdown();
    });
  });
}

let reqCount = 0;
let connectionArray;
   // basePath is the root directory for applications. (Like webapps on Tomcat or htdocs on Apache httpd.)
   // The default is the directory of the entry point or main module for the application.
   // It can be reset by the app developer using .setAppPath(appDir);
 //  let basePath = path.normalize(require.main.filename.substring(0,require.main.filename.lastIndexOf(path.sep)));
   let basePath = serverInstallationPath;
   let bCaching=false, bCachingCheck=false, compress=false, showMimes=false;
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
    serverError("error: problem with proxy object: " + e.message,e);
  }
}
exports.showMimeTypes = function () {
  showMimes=true;
}
exports.setCompress = function (on) {
  if (typeof on == "boolean") {
    compress=on;
    if (compress) {
      zlib = require('node:zlib');
      streamPipeline = require('node:stream').pipeline;
    }
  } else {
    serverError("ERROR: setCompress(true) requires a boolean argument. (default: false)");
  }
}
exports.setNodeEnv = function (env) {
  process.env.NODE_ENV=env;
  serverEvent("CONFIG","NODE_ENV set to " + env);
}
exports.setRootDir = function () {
  serverError("ERROR: setRootDir() is no longer supported. Use setAppPath() instead.");
}
exports.setAppPath = function (bp) {
  servletResolutionCache.clear();
  servletResolutionAliases.clear();
  try {
    let newPath = path.normalize(bp);
    if (!fs.existsSync(newPath)) {
      serverWarning("\nWARNING: App. Path: " + newPath + " does not exist.");
    } else {
      basePath = newPath;
    }
  } catch (err) {serverError(String(err),err);}
}
exports.setCaching = function (b) {
  try {
    if (b && fs.statSync(basePath).mtimeMs === undefined) {
      bCaching=false;
      serverError("\nFAILURE to set browser caching support.\nNode version must be v8 or higher.");
    } else {
      bCaching=b; // boolean
    }
    bCachingCheck=true;
  } catch (err) {
    serverError("ERROR setCaching: " + err,err);
  }
}
// CORS - not yet implemented
exports.allowAccess = function (ad) {
  let acds;
  if (ad.length > 0) {
    corsdomains = ad.split(",");
  } else {
    serverWarning("No domains in access list.");
    return;
  }
}
function methodNotSupportedMessage(req) {
    return (
        req.method +
        " request method is not yet supported on the server: " +
        version
    );
}

function methodNotSupported(req, res) {
    let message = methodNotSupportedMessage(req);

    res.statusCode = 501;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    developmentLog(message);
    res.end(message);
}

function handleResolvedResource(req, res, fileInfo, sendBody = true, servletCacheKey) {
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
   } else if (fileInfo.notAcceptable) {
     reportError(res,fileInfo.fullPath,406,"No acceptable representation is available.",sendBody);
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
	     if (mode === "production") {
         let servletIdentity=servletPhysicalIdentity(fileInfo.fullPath);
         servletResolutionCache.set(servletIdentity,{
           basePath:fileInfo.basePath,
           path:fileInfo.path,
           fullPath:fileInfo.fullPath,
           dirPath:fileInfo.dirPath,
           suffix:fileInfo.suffix,
           contentType:fileInfo.contentType,
           account:accountInfo.account
         });
         servletResolutionAliases.set(
           servletRequestIdentity(fileInfo.basePath,servletCacheKey),
           servletIdentity
         );
       }
	     return handlePreparedServlet(req,res,fileInfo,accountInfo.account,sendBody);
	   } else {
	     reportError(res,accountInfo.account,accountInfo.code,accountInfo.reason,sendBody);
	   }
   }
}

function servletResourcePath(resourceTarget) {
    let queryStart=resourceTarget.indexOf("?");
    return queryStart === -1
      ? resourceTarget
      : resourceTarget.substring(0,queryStart);
}

function servletPhysicalIdentity(fullPath) {
    let identity=path.resolve(fullPath);
    return process.platform === "win32" ? identity.toLowerCase() : identity;
}

function servletRequestIdentity(basePath,resourceTarget) {
    let proxyRequest=proxies && checkProxies(resourceTarget);
    let resourcePath=servletResourcePath(
      proxyRequest ? proxyRequest.url : resourceTarget
    );
    let identity=containedRequestPath(basePath,resourcePath);
    if (!identity) return false;
    return servletPhysicalIdentity(identity);
}

function prepareProxyRequest(resourceTarget) {
    if (!proxies) return false;
    let proxyRequest=checkProxies(resourceTarget);
    if (proxyRequest) {
      proxyRequest.options.url=proxyRequest.url;
      achieve_proxy = _this.loadModule('achieve-proxy');
    }
    return proxyRequest;
}

function cachedServletFileInfo(cached,req,resourceTarget) {
    let proxyRequest=prepareProxyRequest(resourceTarget);
    let currentTarget=proxyRequest ? proxyRequest.url : resourceTarget;
    let queryStart=currentTarget.indexOf("?");
    return new FileInfo(
      cached.basePath,
      cached.path,
      cached.fullPath,
      cached.dirPath,
      cached.suffix,
      req.headers,
      cached.contentType,
      queryStart === -1 ? "" : currentTarget.substring(queryStart+1),
      false,
      false,
      false,
      false,
      "",
      false,
      proxyRequest ? proxyRequest.options : ""
    );
}

function handlePreparedServlet(req,res,fileInfo,account,sendBody) {
    if (evaluatePreconditions(req,res,true)) return;
    try {
      return new startObject(req,res,fileInfo,account,sendBody).init();
    } catch (err) {}
}

function cachedServlet(basePath,resourceTarget) {
    if (mode !== "production") return;
    let servletIdentity=servletResolutionAliases.get(
      servletRequestIdentity(basePath,resourceTarget)
    );
    if (!servletIdentity) return;
    return servletResolutionCache.get(servletIdentity);
}

function handleGet(req, res, basePath, resourceTarget) {
    let cached=cachedServlet(basePath,resourceTarget);
    if (cached) {
      return handlePreparedServlet(req,res,cachedServletFileInfo(cached,req,resourceTarget),cached.account,true);
    }
    let fileInfo = setFileInfo(req, res, basePath, resourceTarget);
    return handleResolvedResource(req, res, fileInfo, true, resourceTarget);
}

function handlePost(req, res, basePath, resourceTarget) {
    let cached=cachedServlet(basePath,resourceTarget);
    if (cached) {
      return handlePreparedServlet(req,res,cachedServletFileInfo(cached,req,resourceTarget),cached.account,true);
    }
    let fileInfo = setFileInfo(req, res, basePath, resourceTarget);
    return handleResolvedResource(req, res, fileInfo, true, resourceTarget);
}

function handleHead(req, res, basePath, resourceTarget) {
    let cached=cachedServlet(basePath,resourceTarget);
    if (cached) {
      return handlePreparedServlet(req,res,cachedServletFileInfo(cached,req,resourceTarget),cached.account,false);
    }
    let fileInfo = setFileInfo(req, res, basePath, resourceTarget);
    return handleResolvedResource(req, res, fileInfo, false, resourceTarget);
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
  if (typeof target !== "string") return false;

  let host;
  let port;
  if (target.charAt(0) === "[") {
    let hostEnd = target.indexOf("]");
    if (hostEnd === -1 || target.charAt(hostEnd + 1) !== ":") return false;
    host = target.substring(0,hostEnd + 1);
    port = target.substring(hostEnd + 2);
  } else {
    let portStart = target.lastIndexOf(":");
    if (portStart <= 0 || target.indexOf(":") !== portStart) return false;
    host = target.substring(0,portStart);
    port = target.substring(portStart + 1);
  }

  return (
    validHostValue(host) &&
    /^\d+$/.test(port) &&
    Number(port) <= 65535
  );
}

function rawPathContainsBackslash(target) {
  let queryStart = target.indexOf("?");
  let pathname = queryStart === -1
    ? target
    : target.substring(0,queryStart);
  return pathname.indexOf("\\") !== -1;
}

function absoluteAuthorityHost(authority) {
  let hostValue = authority;
  let userinfoEnd = authority.indexOf("@");
  if (userinfoEnd !== -1) {
    if (authority.indexOf("@",userinfoEnd + 1) !== -1) return false;
    let userinfo = authority.substring(0,userinfoEnd);
    if (!/^(?:[A-Za-z0-9._~!$&'()*+,;=:]|%[0-9A-F]{2})*$/i.test(userinfo)) {
      return false;
    }
    hostValue = authority.substring(userinfoEnd + 1);
  }

  if (!validHostValue(hostValue)) return false;
  if (hostValue.charAt(0) === "[") return hostValue;

  let portStart = hostValue.lastIndexOf(":");
  let host = portStart === -1
    ? hostValue
    : hostValue.substring(0,portStart);
  return host.length > 0 ? hostValue : false;
}

function requestTarget(req) {
  let rawTarget = req.url;

  if (rawTarget.charAt(0) === "/") {
    if (req.method === "CONNECT") return false;
    if (rawPathContainsBackslash(rawTarget)) return false;
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

  if (rawPathContainsBackslash(rawTarget)) return false;
  let scheme = rawTarget.match(/^https?:\/\//i);
  if (!scheme || rawTarget.indexOf("#") !== -1) return false;

  let authorityStart = scheme[0].length;
  let pathStart = rawTarget.indexOf("/",authorityStart);
  let queryStart = rawTarget.indexOf("?",authorityStart);
  let resourceStart;
  if (pathStart === -1) {
    resourceStart = queryStart;
  } else if (queryStart === -1) {
    resourceStart = pathStart;
  } else {
    resourceStart = Math.min(pathStart,queryStart);
  }
  let authorityEnd = resourceStart === -1
    ? rawTarget.length
    : resourceStart;
  let authority = absoluteAuthorityHost(
    rawTarget.substring(authorityStart,authorityEnd)
  );
  if (!authority) return false;

  let resourceTarget = resourceStart === -1
    ? "/"
    : rawTarget.substring(resourceStart);
  if (resourceTarget.charAt(0) === "?") resourceTarget = "/" + resourceTarget;
  return {
    form:"absolute",
    authority:authority,
    resourceTarget:resourceTarget
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

function connectResponseText(statusCode,statusMessage,contentType,body) {
  return (
    "HTTP/1.1 " + statusCode + " " + statusMessage + "\r\n" +
    "Content-Type: " + contentType + "\r\n" +
    "Content-Length: " + Buffer.byteLength(body,"utf8") + "\r\n" +
    "Connection: close\r\n" +
    "Date: " + new Date().toUTCString() + "\r\n" +
    "\r\n" +
    body
  );
}

function handleConnectRequests(server) {
  server.on('connect',function(req,socket,head) {
    let recordAccess = createAccessRecorder(req);
    let responseStatus = 500;
    let responseStarted = false;
    let responseCompleted = false;

    function recordAborted() {
      if (recordAccess) recordAccess(responseStatus,"aborted");
    }

    socket.once("error",recordAborted);
    socket.once("close",function () {
      if (!responseCompleted) recordAborted();
    });

    function endResponse(statusCode,statusMessage,contentType,body) {
      responseStatus = statusCode;
      if (!socket.writable) {
        recordAborted();
        socket.destroy();
        return;
      }

      let responseText = connectResponseText(
        statusCode,
        statusMessage,
        contentType,
        body
      );
      responseStarted = true;
      socket.end(responseText,function () {
        responseCompleted = true;
        if (recordAccess) recordAccess(statusCode,"complete");
      });
    }

    try {
      let targetInfo = requestTarget(req);
      if (!targetInfo || !validHttp11Host(req)) {
        endResponse(
          400,
          "Bad Request",
          "text/plain;charset=utf-8",
          "Bad Request"
        );
        return;
      }

      let message = methodNotSupportedMessage(req);
      developmentLog(message);
      endResponse(
        501,
        "Not Implemented",
        "text/plain; charset=utf-8",
        message
      );
    } catch (err) {
      serverError("Catchall error handling CONNECT.",err);
      if (responseStarted || !socket.writable) {
        recordAborted();
        if (!socket.destroyed) socket.destroy();
        return;
      }

      try {
        endResponse(
          500,
          "Internal Server Error",
          "text/plain;charset=utf-8",
          "Internal Server Error"
        );
      } catch (responseError) {
        serverError("Failed to send CONNECT catchall error response.",responseError);
        recordAborted();
        if (!socket.destroyed) socket.destroy();
      }
    }
  });
}

function attachStartupLogging(server,protocol,port) {
  server.once("listening",function () {
    serverEvent("START",version + " mode=" + mode);
    serverEvent(
      "CONFIG",
      "logging console=" + (logging.console ? "on" : "off") +
      " server=" + (logging.server ? "on" : "off") +
      " access=" + (logging.access ? "on" : "off") +
      (logging.server || logging.access ? " logRoot=" + logRoot : "")
    );
    serverEvent(
      "CONFIG",
      "appPath=" + basePath
    );
    serverEvent(
      "CONFIG",
      "caching=" + (bCaching ? "on" : "off") +
      " compression=" + (compress ? "on" : "off")
    );
    serverEvent("LISTEN","protocol=" + protocol + " port=" + port);
  });
  server.on("error",function (err) {
    serverError(protocol + " listener error on port " + port + ": " + err.message,err);
  });
}

var achieveApp = function (req, res) {
  attachAccessLogging(req,res);
  developmentLog(req.method);
 try {
   // Get information about the requested file or application.
 //  let urlParsed = url.parse(req.headers.referer, true);
   developmentLog("url: " + req.url + ", origin: " + req.socket.remoteAddress);
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
   console.log("remoteAddress: " + req.socket.remoteAddress);
*/
   
   
 //  res.setHeader('Access-Control-Allow-Headers', '*');
  // res.setHeader('Access-Control-Allow-Origin', '*');
   // res.ok = 1;
   req.protocol = this.protocol;
   return dispatchMethod(req, res, basePath, targetInfo.resourceTarget);
 } catch (e) {
   serverError("Catchall error in achieveApp.",e);
   if (res.destroyed || res.writableEnded) return;
   if (res.headersSent) {
     res.destroy();
     return;
   }
   try {
     res.statusCode=500;
     res.setHeader('Content-Type','text/plain;charset=utf-8');
     res.end("Internal Server Error");
   } catch (responseError) {
     serverError("Failed to send catchall error response.",responseError);
     if (!res.destroyed) res.destroy();
   }
 }
}
function normalizedPort(port) {
  if (typeof port === "string") {
    let numericPort=port.trim();
    if (!/^\d+$/.test(numericPort)) return false;
    port=Number(numericPort);
  }
  if (typeof port !== "number" || !Number.isInteger(port)) return false;
  return port;
}
exports.listen2 = function (ioptions) {
  if (!canStartListener()) return;
  http2 = require('http2');
  
  let server;
  let ssl = false;
  let sport, portDefault;

  try {
  if (typeof ioptions === "object") {
    if (ioptions.key === undefined || ioptions.cert === undefined) {
      serverError("FATAL ERROR: Security certification list is insufficient for SSL.");
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
  } else if (normalizedPort(sport) === false) {
    serverWarning("http2 port " + sport + " is not a number. Setting port to default: " + portDefault + ".");
    sport=portDefault;
  } else {
    sport=normalizedPort(sport);
  }
  if ((sport<1024 && sport != portDefault) || sport>49151) {
    serverWarning("http2 port " + sport + " is outside acceptable range. (1024-49151) Setting port to default: " + portDefault + ".");
    sport=portDefault;
  }
  } catch (err) {
    serverWarning("Error setting port in listen2(). Setting port to default.")
    sport=portDefault;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  if (!initializeLogging()) return;

  if (ssl) {
    server = http2.createSecureServer(ioptions, achieveApp.bind({protocol:"http2.https"}));
  } else {
    server = http2.createServer(achieveApp.bind({protocol:"http2.http"}));
  }
  attachStartupLogging(server,ssl ? "http2.https" : "http2.http",sport);
  registerListener(server);
  server.listen(sport);
  return server;
  
}
exports.slisten = function (ioptions) {
  if (!canStartListener()) return;
  https = require('https');
  
  let server;
  let tlsOptions;
  let sport;

  try {
  if (typeof ioptions !== "object") {
    serverError("FATAL ERROR: slisten() requires an options object as argument.");
    return;
  }
  if (ioptions.key === undefined || ioptions.cert === undefined) {
    serverError("FATAL ERROR: Security certification list is insufficient.");
    return;
  }
  sport = ioptions.httpsPort;
  if (sport === undefined) {
    sport=443;
  } else if (normalizedPort(sport) === false) {
    serverWarning("https port " + sport + " is not a number. Setting port to default.");
    sport=443;
  } else {
    sport=normalizedPort(sport);
  }
  if ((sport<1024 && sport!=443) || sport>49151) {
    serverWarning("https port " + sport + " is outside acceptable range. (1024-49151) Setting port to default.");
    sport=443;
  }
  } catch (err) {
    serverWarning("Error setting port in slisten(). Setting port to default.")
    sport=443;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  if (!initializeLogging()) return;
  
  server = https.createServer(ioptions, achieveApp.bind({protocol:"https"}));
  handleConnectRequests(server);
  attachStartupLogging(server,"https",sport);
  registerListener(server);
  server.listen(sport);
/*
  server.on('connection', function (socket) {
    console.log("*********** CONNECTION : " + JSON.stringify(socket));
    connectionArray = socket;
  });
*/

  return server;
  
}
exports.listen = function (port) {
  if (!canStartListener()) return;
  http = require('http');
    
  let server;

  try {
  
  if (port === undefined) {
    port=80;
  } else if (normalizedPort(port) === false) {
    serverWarning(port + " is not a number. Setting port to default.");
    port=80;
  } else {
    port=normalizedPort(port);
  }
  if ((port<1024 && port != 80) || port>49151) {
    serverWarning("Port " + port + " is outside acceptable range. (1024-49151) Setting port to default.");
    port=80;
  }
  } catch (err) {
    serverWarning("Error setting port in listen(). Setting port to default.")
    port=80;
  }
  if (!bCachingCheck) exports.setCaching(bCaching);
  if (!initializeLogging()) return;
  
  server = http.createServer(achieveApp.bind({protocol:"http"}));
  handleConnectRequests(server);
  attachStartupLogging(server,"http",port);
  registerListener(server);
  server.listen(port);
  
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
  return server;
}
// extension offers a way to add functionality to the server, which will be available via the context object.
// NOT YET IMPLEMENTED
exports.extension = {};
exports.addExtension = function (name,obj) {
  if (obj === undefined || name.length < 1) {
    serverError("addExtension() error: Two arguments required. First is a string representing the name of the extension. The second is the value of the extension.");
  }
  var nameType=true;
  if (typeof name == "string") {
    this.extension[name]=obj;
  } else {
    serverError("addExtension() error: First argument must be a valid string for name of the extension.");
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
    if (!extType || !extForm) serverError("addMimeType(extension,mime) error: First argument must be a file suffix string such as 'html'");
    if (!mimeType || !mimeForm) serverError("addMimeType(extension,mime) error: Second argument must be a MIME type string such as 'text/html'");
  }
  } catch (err) {serverError("addMimeType() failed.",err);}
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
    if (!extType || !extForm) serverError("addAVMimeType(extension,mime) error: First argument must be a file suffix string such as 'html'");
    if (!mimeType || !mimeForm) serverError("addAVMimeType(extension,mime) error: Second argument must be a MIME type string such as 'text/html'");
  }
  } catch (err) {serverError("addAVMimeType() failed.",err);}
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
	  if (statusCode >= 500) serverError(statusCode + ": " + reason);
    else developmentLog(statusCode + ": " + reason);
    res.statusCode=statusCode;
    res.setHeader('Content-Type','text/plain;charset=utf-8');
    if (sendBody) {
      res.end(reason);
    } else {
      res.end();
    }
  }
}
function FileInfo (basePath,path,fullPath,dirPath,suffix,headers,contentType,queryString,serveFile,redirect,noSuchFile,reload,etag,audioVisual,proxyOptions,notAcceptable = false) {
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
  this.notAcceptable = notAcceptable;
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
  let candidate = path.join(boundary,requestPath);
  let relativeCandidate = path.relative(boundary,candidate);

  if (
    relativeCandidate === ".." ||
    relativeCandidate.startsWith(".." + path.sep) ||
    path.isAbsolute(relativeCandidate)
  ) {
    return false;
  }

  return candidate;
}
function checkPath (basePath,relativePath,directoryForm) {
  // Build full path.
  let action="";
  let fullPath = containedRequestPath(basePath,relativePath);
  let stats, checkPath;
  let reload=false;

  if (!fullPath) {
    return new PathInfo(relativePath,false,"noSuchFile",stats);
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
    if (!directoryForm) return new PathInfo(path.normalize(relativePath),false,"redirect",stats);
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
   let notAcceptable = false;
developmentLog("req.url: " + req.url);
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
   let queryStart = requestUrl.indexOf("?");
   let uncheckedPath = queryStart === -1
     ? requestUrl
     : requestUrl.substring(0,queryStart);
   queryString = queryStart === -1
     ? ""
     : requestUrl.substring(queryStart + 1);
    // checkPath returns path request after performing various checks, (See checkPath() for details.)
   let checkedPath = checkPath(thisBasePath,uncheckedPath,uncheckedPath.endsWith("/"));
   if (checkedPath.action == "noSuchFile") return new FileInfo(thisBasePath,requestUrl,checkedPath.filePath,dirPath,suffix,headers,contentType,queryString,false,false,true,reload,etag,audioVisual,proxyOptions);
   // If null, redirect in FileInfo object is set to true. (Needs redirect to add trailing slash.)
   if (checkedPath.action == "redirect") return new FileInfo(thisBasePath,requestUrl,fullPath,dirPath,suffix,headers,contentType,queryString,false,true,false,reload,etag,audioVisual,proxyOptions);
   let currentPath = checkedPath.filePath;
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
        let schedule = true;
        for (let candidate of enc.candidates) {
          if (candidate.quality < enc.identityQuality) break;
          let ccPath = checkCPath(fullPath,candidate.ext,checkedPath.stats,thisBasePath,schedule);
          schedule = false;
          if (ccPath !== false) {
            currentPath = path.relative(thisBasePath,ccPath);
            res.setHeader("Content-Encoding",candidate.contentEncoding);
            etagCoding = candidate.contentEncoding == "gzip" ? "g" : "d";
            break;
          }
        }
        if (etagCoding == "i" && enc.identityQuality == 0) notAcceptable = true;
      }
      if (!notAcceptable && (bCaching || hasEntityTagPrecondition(req))) {
        etag = representationETag(checkedPath.stats.mtimeMs,etagCoding);
      }
    }
    return new FileInfo(thisBasePath,currentPath,fullPath,dirPath,suffix,headers,contentType,queryString,serveFile,false,false,checkedPath.reload,etag,audioVisual,proxyOptions,notAcceptable);
}
function removeCompressionTemp (tempPath,callback) {
  fs.unlink(tempPath,function (err) {
    if (err && err.code !== "ENOENT") {
      serverError(tempPath + "  Compression temporary-file cleanup failed.",err);
    }
    callback();
  });
}
function compressionArtifactPath (basePath,sourcePath,ext) {
  let cachePath=path.join(basePath,".compression-cache");
  let cacheRelative=path.relative(cachePath,sourcePath);
  if (
    cacheRelative === "" ||
    (
      cacheRelative !== ".." &&
      !cacheRelative.startsWith(".." + path.sep) &&
      !path.isAbsolute(cacheRelative)
    )
  ) {
    return false;
  }
  return path.join(cachePath,path.relative(basePath,sourcePath)) + ext;
}
function scheduleCompressedArtifact (sourcePath,artifactPath,ext,sourceStats) {
  if (compressionJobs.has(artifactPath)) return;
  compressionJobs.add(artifactPath);

  let sourceMtimeMs=sourceStats.mtimeMs;
  let sourceSize=sourceStats.size;
  let tempPath = artifactPath +
    ".tmp-" + process.pid +
    "-" + Date.now() +
    "-" + (++compressionTempSequence);

  function clearJob () {
    compressionJobs.delete(artifactPath);
  }
  function fail (message,err) {
    serverError(message,err);
    removeCompressionTemp(tempPath,clearJob);
  }

  fs.mkdir(path.dirname(artifactPath),{recursive:true},function (err) {
    if (err) {
      serverError(artifactPath + "  Compression cache directory creation failed.",err);
      clearJob();
      return;
    }
    try {
      let compressor = ext == ".gz"
        ? zlib.createGzip()
        : zlib.createDeflate();
      streamPipeline(
        fs.createReadStream(sourcePath),
        compressor,
        fs.createWriteStream(tempPath,{flags:"wx"}),
        function (err) {
          if (err) {
            fail(sourcePath + "  Compression failed.",err);
            return;
          }
          fs.stat(sourcePath,function (err,currentStats) {
            if (err) {
              fail(sourcePath + "  Compression source restat failed.",err);
              return;
            }
            if (
              currentStats.mtimeMs !== sourceMtimeMs ||
              currentStats.size !== sourceSize
            ) {
              removeCompressionTemp(tempPath,clearJob);
              return;
            }
            fs.rename(tempPath,artifactPath,function (err) {
              if (err) {
                fail(artifactPath + "  Compression artifact publication failed.",err);
                return;
              }
              clearJob();
            });
          });
        }
      );
    } catch (err) {
      fail(sourcePath + "  Compression failed.",err);
    }
  });
}
function checkCPath (path,ext,sourceStats,basePath,schedule = true) {
  let artifactPath=compressionArtifactPath(basePath,path,ext);
  if (!artifactPath) return false;
  try {
    if (fs.existsSync(artifactPath)) {
      let cstats = fs.statSync(artifactPath);
      if (sourceStats.mtimeMs <= cstats.mtimeMs) return artifactPath;
    }
  } catch (err) {
    serverError(path + "  Compression failed.",err);
    return false;
  }
  if (schedule) scheduleCompressedArtifact(path,artifactPath,ext,sourceStats);
  return false;
}
function encodingQuality (value) {
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value)) return false;
  let parts=value.split(".");
  let fraction=(parts[1] || "").padEnd(3,"0");
  return Number(parts[0])*1000+Number(fraction);
}
function getEncoding (req) {
  let acceptEncoding=req.headers['accept-encoding'];
  let qualities={};
  if (acceptEncoding !== undefined && acceptEncoding !== "") {
    for (let fieldMember of acceptEncoding.split(",")) {
      let member=fieldMember.trim();
      if (member === "") continue;
      let parts=member.split(";");
      if (parts.length > 2) continue;
      let coding=parts[0].trim().toLowerCase();
      if (!/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(coding)) continue;
      let quality=1000;
      if (parts.length == 2) {
        let match=/^q=(.*)$/i.exec(parts[1].trim());
        if (!match) continue;
        quality=encodingQuality(match[1]);
        if (quality === false) continue;
      }
      if (
        coding == "gzip" ||
        coding == "deflate" ||
        coding == "identity" ||
        coding == "*"
      ) {
        if (qualities[coding] === undefined || quality > qualities[coding]) {
          qualities[coding]=quality;
        }
      }
    }
  }
  let gzipQuality=qualities.gzip === undefined ? qualities["*"] : qualities.gzip;
  let deflateQuality=qualities.deflate === undefined ? qualities["*"] : qualities.deflate;
  let identityQuality=qualities.identity === undefined
    ? (qualities["*"] === 0 ? 0 : 1000)
    : qualities.identity;
  let candidates=[];
  if (gzipQuality > 0) candidates.push({contentEncoding:"gzip",ext:".gz",quality:gzipQuality});
  if (deflateQuality > 0) candidates.push({contentEncoding:"deflate",ext:".zl",quality:deflateQuality});
  if (candidates.length == 2 && candidates[1].quality > candidates[0].quality) candidates.reverse();
  return {candidates:candidates,identityQuality:identityQuality};
}
function nodeVersion () {
  var result="";
  var temp = process.versions.node.split('.');
  for (var i=0; i<temp.length; i++) result += temp[i];
  return result;
}
function display (fi) {
  developmentLog("\nFile Info: " + reqCount++);
  var propValue;
  for(var propName in fi) {
    propValue = fi[propName];
    developmentLog("  " + propName,propValue);
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
          developmentLog("using POST");
	      this.req.on('data', function(data) {
			try {
              queryData += data;
              if(queryData.length > 1e6) {
                queryData = "";
              }
			} catch (err) {
		      serverError("Error processing POST data.",err);
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
        if (response.writableEnded || context.allowAsync) {
          developmentLog("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
        } else if (content === undefined || content === null) {
          wmsg="WARNING: Return value from servlet " + fileInfo.path + " is " + content + ".";
          response.statusCode=500;
			    response.write(wmsg);
          response.end();
          serverError(wmsg);
          return;
        }
          response.statusCode=200;
			    response.write(content,'binary');
          response.end(null,'binary');
		  } catch (err) {
          if (response.headersSent) {
            wmsg=rtErrorMsg(err);
            serverError(wmsg,err);
            if (!response.writableEnded && !response.destroyed) {
              response.destroy();
            }
            return;
          }
          if (response.writableEnded || (context && context.allowAsync)) {
          developmentLog("INFO: POST " + fileInfo.path + " Session ended or will end by application.");
          return;
          }
          wmsg=rtErrorMsg(err);
          response.statusCode=500;
			    response.write(wmsg);
          response.end();
          serverError(wmsg,err);
		  	}
	      });
        } else if (
          this.req.method == "GET" ||
          this.req.method == "HEAD"
        ) {
          developmentLog("using GET");
          let context;
		  try {
        request.get =  querystring.parse(fileInfo.queryString);
		  	let boundLoader = load.bind({request:request,response:response,dirPath:fileInfo.dirPath});
        // This is where the application code is "called"
        context = new Context(request,response,request.get,fileInfo.dirPath,boundLoader,fileInfo.proxyOptions,proxies,achieve_proxy);
        let content = myApp.servlet(context);
        if (response.writableEnded || context.allowAsync) {
          developmentLog("INFO: GET " + fileInfo.path + " session ended or will end by application.");
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
          serverError(wmsg,err);
          if (!response.writableEnded && !response.destroyed) {
            response.destroy();
          }
          return;
        }
        if (response.writableEnded || (context && context.allowAsync)) {
          developmentLog("INFO: GET " + fileInfo.path + " session ended or will end by application.");
          return;
        }
        wmsg=rtErrorMsg(err);
        response.statusCode=500;
        response.end(wmsg);
        serverError(wmsg,err);
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
  this.fp = path.join(fileInfo.basePath,fileInfo.path);
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
     serverError(err.message,err);
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
    const stats = fs.statSync(fullPath);
	  if (moduleLoadTimes[fullPath] === undefined || moduleLoadTimes[fullPath] < stats.mtimeMs) {
	    delete require.cache[require.resolve(fullPath)];
      moduleLoadTimes[fullPath] = stats.mtimeMs; // new Date().getTime();
	  }
    return require(moduleName);
  } catch (err) {
    serverError("loadModule: " + rtErrorMsg(err),err);
  }
}
let load = function (filePath) {
  let dirname=this.dirPath;
  let fullPath = path.join(dirname,filePath+".js");
  let loadedMtime;
  const stats = fs.statSync(fullPath);
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
// use checkPath() first to get complete file information, including the right application directory
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
const Base64 = {
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
        serverError("Error streaming " + displayedFileName + ": " + rtErrorMsg(err),err);
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

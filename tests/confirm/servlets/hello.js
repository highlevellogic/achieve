
console.log("MODULE LOADED:", __filename, new Date().toISOString());

exports.servlet = function (session) {

console.log("SERVLET CALLED:", __filename);

var msg = "Hello from servlet! This message confirms that the server is running properly.<br>";
  msg += "It returned an HTML page, a javascript file, and executed a js servlet on the backend.<br>";
  msg += "(The servlet for this test is ./tests/confirm/servlets/hello.js)";
  msg += "<br><br>There may be more tests available in ./tests/";

  return msg;
}

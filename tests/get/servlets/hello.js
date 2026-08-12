
console.log("MODULE LOADED:", __filename, new Date().toISOString());

exports.servlet = function (session) {

  console.log("SERVLET CALLED:", __filename);

  var msg = "Hello World! from servlet hello. Using method: " + session.request.method;

  return msg;
}


console.log("MODULE LOADED:", __filename, new Date().toISOString());

exports.servlet = function (session) {

  console.log("SERVLET CALLED:", __filename);

  var demo2 = session.load("demo2");

  var response = demo2.init(session.load);

  return response;

}

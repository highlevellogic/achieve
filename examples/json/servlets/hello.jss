
exports.servlet = function (session) {
  return "Servlet received " + session.params.test;
}

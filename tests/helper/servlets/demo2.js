
exports.init = function (load) {
  return testSecondFile(load);
}
function testSecondFile (load) {
  // To have one js file use code from another,
  // add, use, and delete the second file from the Node.js file cache
  // Use the complete path to specify the file.
  // The actual file name has suffix .js - but is specified to the server without the suffix
  let secondAppFile = "second"; // relative path to file second.js
  let second = load(secondAppFile);  // adding the second file
  var fromSecond = second.init();  // using code in the second file

  return fromSecond;
}

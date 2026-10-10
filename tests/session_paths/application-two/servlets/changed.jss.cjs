exports.servlet = function (session) {
    return JSON.stringify({appPath:session.appPath,dirPath:session.dirPath});
};

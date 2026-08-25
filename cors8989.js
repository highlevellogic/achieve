const achieve = require('./achieve');
const path = require('node:path');

const appPath = path.join(__dirname, 'examples');
achieve.setAppPath(appPath);

achieve.allowOrigins("http://localhost:8990","cors/public/frameworks");
achieve.allowOrigins("http://localhost:8990","cors/public/frameworks2");

achieve.listen(8989);

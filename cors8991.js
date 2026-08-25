const achieve = require('./achieve');
const path = require('node:path');

const appPath = path.join(__dirname, 'examples');
achieve.setAppPath(appPath);

achieve.listen(8991);

const achieve = require('./achieve');
const path = require('node:path');

const appPath = path.join(__dirname, 'tests');
achieve.setAppPath(appPath);

achieve.listen(8989);

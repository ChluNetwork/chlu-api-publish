const mkdirp = require('mkdirp');

async function ensureDir(dir) {
  return await new Promise((resolve, reject) => {
    mkdirp(dir, err => err ? reject(err) : resolve());
  });
}

module.exports = { ensureDir }
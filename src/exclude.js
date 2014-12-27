let through = require('through2');
let minimatch = require('minimatch');

/**
 * @param {Array} patterns
 * @return {Object}
 */
export default function exclude(patterns) {
  return through.obj((file, enc, cb) => {
    if (patterns.find(x => minimatch(file.relative, x))) {
      return cb();
    }

    cb(null, file);
  });
}

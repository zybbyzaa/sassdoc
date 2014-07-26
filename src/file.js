'use strict';

var fs     = require('fs');          // File system
var mkdirp = require('mkdirp');      // mkdir -p
var rimraf = require('rimraf');      // rm -rf
var ncp    = require('ncp');         // cp -r
var Q      = require('q');           // Promises
var path   = require('path');        // Path
//var _      = require('lodash');      // Lo-Dash

var parser = require('./parser');
var utils  = require('./utils');
var logger = require('./log');

ncp.limit = 16;

exports = module.exports = {

  /**
   * Folder API
   */
  folder: {
    /**
     * Store project base directory.
     */
    base: '',

    /**
     * Read a folder
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_readdir_path_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    read: Q.denodeify(fs.readdir),

    /**
     * Create a folder
     * @see {@link https://github.com/substack/node-mkdirp}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    create: Q.denodeify(mkdirp),

    /**
     * Copy a folder
     * @see {@link https://github.com/AvianFlu/ncp}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    copy: Q.denodeify(ncp),

    /**
     * Remove a folder
     * @see {@link https://github.com/isaacs/rimraf}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    remove: Q.denodeify(rimraf),

    /**
     * Remove then create a folder
     * @param  {String} folder
     * @return {Q.Promise}
     */
    refresh: function (folder) {
      return exports.folder.remove(folder).then(function () {
        logger.log('Folder `' + folder + '` successfully removed.');
        return exports.folder.create(folder);
      }, function () {
        return exports.folder.create(folder);
      });
    },

    /**
     * Parse a folder
     * @param  {String} folder
     * @return {Q.Promise}
     */
    parse: function (folder) {
      return exports.folder.read(folder).then(function (files) {
        var path,
            promises = [],
            data = [];

        files.forEach(function (file) {
          path = folder + '/' + file;

          // Folder
          if (exports.isDirectory(path)) {
            promises.push(exports.folder.parse(path).then(function (response) {
              data = data.concat(response);
            }));
          }

          // SCSS file
          else if (utils.getExtension(path) === 'scss') {
            promises.push(exports.file.process(path).then(function (response) {
              if (Object.keys(response).length > 0) {
                data = data.concat(response);
              }
            }));
          }

          // Else
          else {
            logger.log('File `' + path + '` is not a `.scss` file. Omitted.');
          }
        });

        return Q.all(promises).then(function () {
          return data;
        });

      }, function (err) {
        throw new Error(err);
      });
    }
  },

  /**
   * File API
   */
  file: {
    /**
     * Read a file
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_readfile_filename_options_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    read: Q.denodeify(fs.readFile),

    /**
     * Create a file
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_writefile_filename_data_options_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    create: Q.denodeify(fs.writeFile),

    /**
     * Remove a file
     * @see {@link http://nodejs.org/api/fs.html#fs_fs_unlink_path_callback}
     * @see {@link https://github.com/kriskowal/q/wiki/API-Reference#interfacing-with-nodejs-callbacks}
     */
    remove: Q.denodeify(fs.unlink),

    /**
     * Process a file
     * @param  {String} file
     * @return {Q.Promise}
     */
    process: function (file) {
      return exports.file.read(file, 'utf-8').then(function (code) {
        var data = parser.parse(code);

        // Merge in from which file the comments where loaded.
        Object.keys(data).forEach(function (key) {
          data[key].forEach(function (item) {
            item.file = {
              path: path.relative(exports.folder.base, file),
              name: path.basename(file, '.scss')
            };
          });
        });

        return data;
      });
    }
  },

  /**
   * Test if path is a directory
   * @param  {String}  path
   * @return {Boolean}
   */
  isDirectory: function (path) {
    return fs.lstatSync(path).isDirectory();
  },

  /**
   * Dump CSS
   * @param  {String} destination
   * @return {Q.Promise}
   */
  dumpAssets: function (destination) {
    return exports.folder.copy(__dirname + '/../view/assets', destination + '/assets');
  },

  /**
   * Get data
   * @param {String} folder - folder path
   */
  getData: function (folder) {
    exports.folder.base = folder;

    // Parse the whole folder
    return exports.folder.parse(folder)

    // Extract all items into a flat array
    .then(function (data){
      var flat = [];
      data.forEach(function (obj) {
        Object.keys(obj).forEach(function (type) {
          // Ignore unkown context
          if (type === 'unknown') { return; }
          // Iterate over all items for this type
          obj[type].forEach(function (item) {
            flat.push(item);
          });
        });
      });
      return flat;
    })
    // Run the postProcessor
    .then(parser.postProcess);
  }
};

/**
 * ecma-iceclient, an internet radio client for using in NodeJS.
 * Copyright (C) 2023 mo-g
 * 
 * ecma-iceclient is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 * 
 * ecma-iceclient is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with ecma-iceclient  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * This program contains code licenced under (The MIT License)

 * Copyright (c) 2011 Nathan Rajlich <nathan@tootallnate.net>

 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:

 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */


/**
 * Module dependencies.
 */

var assert = require('assert');
var Parser = require('stream-parser');
var inherits = require('util').inherits;
var debug = require('debug')('icy:reader');
var Transform = require('stream').Transform;


/**
 * Module exports.
 */

module.exports = Reader;

/**
 * The metabyte must be multiplied by META_BLOCK_SIZE to get the real
 * metadata byte-length.
 *
 * @api private
 */

var META_BLOCK_SIZE = 16;

/**
 * ICY stream reader. This is a duplex stream that emits "metadata" events in
 * addition to stripping out the metadata itself from the output data. The result
 * is clean (audio and/or video) data coming out of the stream.
 *
 * @param {Number} metaint the number of bytes in between "metadata" blocks (usually the `Icy-MetaInt` HTTP header).
 * @param {Object} opts optional options object
 * @api public
 */

function Reader (metaint, opts) {
  if (!(this instanceof Reader)) {
    return new Reader(metaint, opts);
  }
  if (!isFinite(metaint)) {
    throw new TypeError('Reader requires a "metaint" number');
  }
  Transform.call(this, opts);
  this.metaint = +metaint;
  this._passthrough(this.metaint, this._onRawData);
  debug('created new Reader instance with "metaint": %d', this.metaint);
}
inherits(Reader, Transform);

/**
 * Mixin `Parser`.
 */

Parser(Reader.prototype);

/**
 * Called after "metaint" bytes have been passed through.
 *
 * @api private
 */

Reader.prototype._onRawData = function () {
  debug('_onRawData()');
  this._bytes(1, this._onMetaByte);
};

/**
 * Called when the "metabyte" has been received.
 *
 * @api private
 */

Reader.prototype._onMetaByte = function (chunk) {
  assert(chunk.length === 1);
  var length = chunk[0] * META_BLOCK_SIZE;
  debug('_onMetaByte: metabyte: %d, metalength: %d', chunk[0], length, chunk);
  if (length > 0) {
    // we have metadata to parse
    this._bytes(length, this._onMetaData);
  } else {
    // not metadata this time around, back to serving raw data chunks
    this._passthrough(this.metaint, this._onRawData);
  }
};

/**
 * Called once all the metadata has been buffered for this pass.
 *
 * @api private
 */

Reader.prototype._onMetaData = function (chunk) {
  debug('_onMetaData (chunk.length: %d)', chunk.length);
  this.emit('metadata', chunk);
  this._passthrough(this.metaint, this._onRawData);
};

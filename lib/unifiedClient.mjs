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
var http = require('http');
var https = require('https');
var url = require('url');
//var Transform = require('stream').Transform;

import { PassThrough } from 'stream';


const HTTP10 = Buffer.from('HTTP/1.0'); // The fake HTTP version to write when an "ICY" version is encountered.
const META_BLOCK_SIZE = 16; // The metabyte must be multiplied by META_BLOCK_SIZE to get the real metadata byte-length.


/**
 * This all really... really.. sucks...
 * 
 * You said it, not me!
 */

function preprocessor (socket) {
  debug('setting up "data" preprocessor');

  function ondata (chunk) {
    // TODO: don't be lazy, buffer if needed...
    assert(chunk.length >= 3, 'buffer too small! ' + chunk.length);
    if (/icy/i.test(chunk.slice(0, 3))) {
      debug('got ICY response!');
      var b = new Buffer(chunk.length + HTTP10.length - 'icy'.length);
      var i = 0;
      i += HTTP10.copy(b);
      i += chunk.copy(b, i, 3);
      assert.equal(i, b.length);
      chunk = b;
      socket._wasIcy = true;
    } else {
      socket._wasIcy = false;
    }

    return chunk;
  }

  var listeners;
  function icyOnData (buf) {
    var chunk = ondata(buf);

    // clean up, and re-emit "data" event
    socket.removeListener('data', icyOnData);
    listeners.forEach(function (listener) {
      socket.on('data', listener);
    });
    listeners = null;
    socket.emit('data', chunk);
  }

  if ('function' == typeof socket.ondata) {
    // node < v0.11.3, the `ondata` function is set on the socket
    var origOnData = socket.ondata;
    socket.ondata = function (buf, start, length) {
      var chunk = ondata(buf.slice(start, length));

      // now clean up and inject the modified `chunk`
      socket.ondata = origOnData;
      origOnData = null;
      socket.ondata(chunk, 0, chunk.length);
    };
  } else if (socket.listeners('data').length > 0) {
    // node >= v0.11.3, the "data" event is listened for directly

    // add our own "data" listener, and remove all the old ones
    listeners = socket.listeners('data');
    socket.removeAllListeners('data');
    socket.on('data', icyOnData);
  } else {
    // never?
    throw new Error('should not happen...');
  }
}

//###########################################################################
//###########################################################################


function oldReader (metaint, opts) {
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
 * ICY stream reader. This is a duplex stream that emits "metadata" events in
 * addition to stripping out the metadata itself from the output data. The result
 * is clean (audio and/or video) data coming out of the stream.
 *
 * @param {Number} metaint the number of bytes in between "metadata" blocks (usually the `Icy-MetaInt` HTTP header).
 * @param {Object} opts optional options object
 * @api public
 */
class Reader {
    constructor({metadataSpacing = 0} = {}, opts) {
        if (!isFinite(metaint)) {
            throw new TypeError('Reader requires a "metaint" number');
          }
    this.stream = new PassThrough(); //or Transform??
    }

    }
}

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






//###########################################################################
//###########################################################################


/**
 * The `Client` class is a subclass of the `http.ClientRequest` object.
 *
 * It adds a stream preprocessor to make "ICY" responses work. This is only needed
 * because of the strictness of node's HTTP parser. I'll volley for ICY to be
 * supported (or at least configurable) in the http header for the JavaScript
 * HTTP rewrite (v0.12 of node?).
 *
 * The other big difference is that it passes an `icy.Reader` instance
 * instead of a `http.ClientResponse` instance to the "response" event callback,
 * so that the "metadata" events are automatically parsed and the raw audio stream
 * it output without the ICY bytes.
 *
 * Also see the [`request()`](#request) and [`get()`](#get) convenience functions.
 *
 * @param {Object} options connection info and options object
 * @param {Function} cb optional callback function for the "response" event
 * @api public
 */

function oldClient (options, cb) {
  if (typeof options == 'string')
    options = url.parse(options)
  
  var req;
  if (options.protocol == "https:")
    req = https.request(options);
  else
    req = http.request(options);

  // add the "Icy-MetaData" header
  req.setHeader('Icy-MetaData', '1');

  if ('function' == typeof cb) {
    req.once('icyResponse', cb);
  }

  req.once('response', icyOnResponse);
  req.once('socket', icyOnSocket);

  return req;
};

class Client {
    constructor () {

    }
}

/**
 * "response" event listener.
 *
 * @api private
 */

function icyOnResponse (res) {
  debug('request "response" event');

  var s = res;
  var metaint = res.headers['icy-metaint'];
  if (metaint) {
    debug('got metaint: %d', metaint);
    s = new Reader(metaint);
    res.pipe(s);

    s.res = res;

    Object.keys(res).forEach(function (k) {
      if ('_' === k[0]) return;
      debug('proxying %j', k);
      proxy(s, k);
    });
  }
  if (res.connection._wasIcy) {
    s.httpVersion = 'ICY';
  }
  this.emit('icyResponse', s);
}

/**
 * "socket" event listener.
 *
 * @api private
 */

function icyOnSocket (socket) {
  debug('request "socket" event');

  // we have to preprocess the stream (that is, intercept "data" events and
  // emit our own) to make the invalid "ICY" HTTP version get translated into
  // "HTTP/1.0"
  preprocess(socket);
}

/**
 * Proxies "key" from `stream` to `stream.res`.
 *
 * @api private
 */

function proxy (stream, key) {
  if (key in stream) {
    debug('not proxying prop "%s" because it already exists on target stream', key);
    return;
  }

  function get () {
    return stream.res[key];
  }
  function set (v) {
    return stream.res[key] = v;
  }
  Object.defineProperty(stream, key, {
    configurable: true,
    enumerable: true,
    get: get,
    set: set
  });
}

export {Reader, Client};
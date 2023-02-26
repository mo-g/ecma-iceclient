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
var debug = require('debug')('icy:preprocessor');

/**
 * Module exports.
 */

module.exports = preprocessor;

/**
 * The fake HTTP version to write when an "ICY" version is encountered.
 */

var HTTP10 = Buffer.from('HTTP/1.0');

/**
 * This all really... really.. sucks...
 */

function preprocessor (socket) {
  debug('setting up "data" preprocessor');

  function ondata (chunk) {
    // TODO: don't be lazy, buffer if needed...
    assert(chunk.length >= 3, 'buffer too small! ' + chunk.length);
    if (/icy/i.test(chunk.slice(0, 3))) {
      debug('got ICY response!');
      var b = Buffer.alloc(chunk.length + HTTP10.length - 'icy'.length);
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

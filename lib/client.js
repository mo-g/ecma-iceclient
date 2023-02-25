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

var http = require('follow-redirects/http');
var https = require('follow-redirects/https');
var url = require('url');
var Reader = require('./reader');
var preprocess = require('./preprocessor');
var debug = require('debug')('icy:client');

/**
 * Module exports.
 */

exports = module.exports = Client;

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

function Client (options, cb) {
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

/**
 * "response" event listener.
 *
 * @api private
 */

function icyOnResponse (res) {
  debug('request "response" event');

  var s = res;
  var metaint = res.headers['icy-metaint'];
  if (metaint && parseInt(metaint, 10)) {
    debug('got metaint: %d', metaint);
    s = new Reader(metaint);
    res.pipe(s);

    s.res = res;

    Object.keys(res).forEach(function (k) {
      if ('_' === k[0]) return;
      debug('proxying %j', k);
      proxy(s, k);
    });
    proxy(s, 'headers');
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

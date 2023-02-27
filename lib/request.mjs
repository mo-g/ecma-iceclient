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

var Client = require('./client');

/**
 * Module exports.
 */

module.exports = request;

/**
 * `request()` convenience function. Similar to node core's
 * [`http.request()`](http://nodejs.org/docs/latest/api/http.html#http_http_request_options_callback),
 * except it returns an `icy.Client` instance.
 *
 * @param {Object} options connection info and options object
 * @param {Function} cb optional callback function for the "response" event
 * @api public
 */

function request (options, fn) {
  return new Client(options, fn);
};
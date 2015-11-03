/**
 * Doing HTTP on a pipe (as opposed to a server socket).
 */

var assert = require("assert"),
    util = require('util'),
    through2 = require('through2'),
    EventEmitter = require('events').EventEmitter,
    Transform = require('stream').Transform,
// Using node's private API here – This saves us so much work that
    // I'm not even ashamed.
    connectionListener = require('_http_server')._connectionListener,
    ServerResponse = require('_http_server').ServerResponse,
    debug = require("debug")("http_on_pipe");

/**
 * Main entry point.
 * @param stdin
 * @param stdout
 * @param {handler} handler function, HTTP-style
 *                  (takes req and res, eventually calls res.end())
 */
module.exports = function (stdin, stdout, handler) {
    stdin.pipe(new HTTPParserTransform())
        .pipe(through2.obj(
            function (req, enc, consumed) {
                var res = new ResponseToStream(req, stdout,
                    function (e) {
                        if (! e) {
                            debug("Consumed request " + req.url);
                            consumed();
                        } else {
                            debug("Write error responding to " + req.url + ": " + e);
                            consumed(e);
                        }
                    });
                handler(req, res);
            }));
};

/**
 * Handler function to serve with.
 * @callback handler
 * @param {req} A request object
 * @param {res} A response object
 */

/**
 * Harness node.js' private HTTP parser into working with Buffers.
 *
 * Exported for tests.
 *
 * @constructor
 */
var HTTPParser = module.exports.HTTPParser = function () {
    var self = this;
    var fakeServer = {
        timeout: false,
        httpAllowHalfOpen: false
    };
    var fakeSocketEvents = {};
    var fakeSocket = {
        _handle: {},
        addListener: function() {},
        removeListener: function() {},
        on: function(event, cb) {
            if (! (event in {data: 1, end: 1})) { return; }
            debug("fakeSocket.on(\"" + event + "\", ...)");
            fakeSocketEvents[event] = cb;
        },
        destroy: function () {}
    };

    connectionListener.call(fakeServer, fakeSocket);
    assert(fakeSocketEvents.data);
    this.write = function (buf) {
        assert(buf instanceof Buffer);
        return fakeSocketEvents.data(buf);
    };
    assert(fakeSocketEvents.end);
    this.end = function() {
        fakeSocketEvents.end();
    };

    fakeSocket.parser.onIncoming = function (req) {
        self.emit("request", req);
    };
};
util.inherits(HTTPParser, EventEmitter);

/**
 * A transforming stream that produces HTTP requests from a byte stream.
 *
 * @constructor
 */
var HTTPParserTransform = function () {
    var self = this;
    Transform.call(self, { objectMode: true });

    var parser = new HTTPParser();
    parser.on("request", function (req) {
        debug("incoming request: " + req.url);
        self.push(req);
    });
    this._transform = function (chunk, encoding, callback) {
        parser.write(chunk);
        callback();
    };

    this._flush = function (callback) {
        parser.end();
        callback();
    };
};
util.inherits(HTTPParserTransform, Transform);

/**
 * An http.ServerResponse work-alike that writes to a pipe stream.
 *
 * @param req The request we are responding to (to determine HTTP version etc.)
 * @param outStream The pipe to write to
 * @param done Called after .end() returns
 * @constructor
 */
var ResponseToStream = function (req, outStream, done) {
    var self = this;
    ServerResponse.call(self, req);
    self.connection = {
        writable: true,
        _httpMessage: self,
        write: function(d, encoding, callback) {
            debug("Sending response: " + d);
            outStream.write(d, encoding, callback);
        },
        // We don't care about throttling the read side; things don't
        // work that way here.
        cork: function () {},
        uncork: function () {}
    };
    self.on("finish", function () {
        done();
    });
    self.on("error", function (error) {
        done(error);
    });
};

util.inherits(ResponseToStream, ServerResponse);

/**
 * Doing HTTP on a pipe (as opposed to a server socket).
 */

var assert = require("assert"),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Transform = require('stream').Transform,
    Writable = require('stream').Writable,
    // Using node's private API here – This saves us so much work that
    // I'm not even ashamed.
    connectionListener = require('_http_server')._connectionListener,
    ServerResponse = require('_http_server').ServerResponse,
    debug = require("debug")("http_on_pipe"),
    finalhandler = require("finalhandler");

/**
 * Main entry point.
 * @param stdin
 * @param stdout
 * @param {handler} handler Handler function, Connct-style
 *                  (takes req, res and next; eventually calls either res.end()
 *                  or next)
 * @param {Function} done Called when it's time to close shop
 */
module.exports = function (stdin, stdout, handler, done) {
    function callDone(arg) {
        if (! done) return;
        done(arg);
        done = undefined;
    }

    var httpTransform = new HTTPParserTransform();
    httpTransform.on("error", callDone);

    var requestSink = new Writable({ objectMode: true });
    requestSink._write = function (req, unused_enc, consumed) {
        var res = new ResponseToStream(req, stdout,
            function (e) {
                if (! e) {
                    debug("Consumed request " + req.url);
                    consumed();
                } else {
                    debug("Write error responding to " + req.url + ": " + e);
                    callDone(e);
                    consumed(e);
                }
            });
        // Use three-argument handler form to accomodate a Connect-style handler
        handler(req, res, finalhandler(req, res));
    };
    requestSink.on("error", callDone);

    stdin.pipe(httpTransform)
        .pipe(requestSink);

    requestSink.on("finish", function() { callDone(); });
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
        destroy: function (error) {
            if (!error) {
                error = new Error("Parser wants to destroy" +
                    " a perfectly good fakeSocket?")
            }
            self.emit("error", error);
        }
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
    var error;
    parser.on("error", function (e) {
        error = e;
    });
    this._transform = function (chunk, encoding, callback) {
        if (! error) {
            try {
                parser.write(chunk);
                callback();
            } catch (error) {
                debug("Failed in parser.write! " + error);
                parser.end();
                callback(error);
            }
        } else {
            debug("HTTPParserTransform interrupted by error: " + error);
            parser.end();
            callback(error);
        }
    };

    this._flush = function (callback) {
        parser.end();
        debug("HTTPParserTransform closing down" +
            (error ? " for cause of " + error : ""));
        callback(error);
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
    var brokenPipe;
    outStream.on("error", function (err) {
        console.trace(err);
        brokenPipe = err;
        if (done) { done(err); }
        done = undefined;
    });
    self.connection = {
        writable: true,
        _httpMessage: self,
        write: function(d, encoding, callback) {
            if (brokenPipe) {
                debug("Dropping " + d.length + " bytes after write error");
                callback(brokenPipe);
            } else {
                debug("Sending response: " + d);
                outStream.write(d, encoding, callback);
            }
        },
        cork: function () {outStream.cork()},
        uncork: function () {outStream.uncork()}
    };
    self.on("finish", function () {
        if (done) { done(); }
        done = undefined;
    });
    self.on("error", function (error) {
        if (done) { done(error); }
        done = undefined;
    });
};

util.inherits(ResponseToStream, ServerResponse);

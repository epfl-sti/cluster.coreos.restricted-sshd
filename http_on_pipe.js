/**
 * Doing HTTP on a pipe (as opposed to a server socket).
 */

var util = require('util'),
    Readable = require('readable-stream/readable'),
// Using node's private API here – This saves us so much work that
    // I'm not even ashamed.
    connectionListener = require('_http_server')._connectionListener,
    ServerResponse = require('_http_server').ServerResponse,
    debug = require("debug")("http_on_pipe");

/**
 * A transforming stream that parses HTTP requests on a pipe.
 *
 * @constructor
 */
var SlurpHttpParser = exports.SlurpHttpParser = function (inStream) {
    var self = this;
    Readable.call(self);

    var fakeServer = {
        timeout: false,
        httpAllowHalfOpen: false,
        emit: function(event /*, args */) {
            debug("Wanna say something?");
        }
    };
    var fakeSocket = {
        _handle: {},
        addListener: self.addListener.bind(self),  // TODO: should be inStream?
        removeListener: self.removeListener.bind(self),  // TODO: should be inStream?
        on: inStream.on.bind(inStream)
        // TODO: add destroy() and more
    };
    connectionListener.call(fakeServer, fakeSocket);
    fakeSocket.parser.onIncoming = function (req, shouldKeepAlive) {
        debug("incoming request: " + req.url);
        // Readable, unlike Transform, type-checks what is .push()ed
        // But we don't have to play nice:
        self.lastRequest = req;
        self.push(" ");
    };

    self._read = function(ignored_bytes) {
        debug("reading from pipe stream");
    };
};
util.inherits(SlurpHttpParser, Readable);

/**
 * An http.ServerResponse work-alike that writes to a pipe stream.
 *
 * @param req The request we are responding to (to determine HTTP version etc.)
 * @param outStream The pipe to write to
 * @param done Called after .end() returns
 * @constructor
 */
var ResponseToStream = exports.ResponseToStream = function (req, outStream, done) {
    var self = this;
    ServerResponse.call(self, req);
    self.connection = {
        writable: true,
        _httpMessage: self,
        write: function(d, encoding, callback) {
            debug("Sending response: " + d);
            outStream.write(d, encoding, callback);
            // process.nextTick(callback.bind({}));
        }
    };
    self.on("finish", function () {
        done();
    });
    self.on("error", function (error) {
        done(error);
    });
};

util.inherits(ResponseToStream, ServerResponse);

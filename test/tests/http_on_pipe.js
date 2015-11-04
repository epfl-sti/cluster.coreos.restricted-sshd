/**
 * Tests over http_on_pipe.js
 */

var assert = require("assert"),
    Q = require("q"),
    Readable = require('stream').Readable,
    Writable = require('stream').Writable,
    debug = require("debug")("tests/http_on_pipe"),
    http_on_pipe = require("../../http_on_pipe"),
    HTTPParser = http_on_pipe.HTTPParser;

require("../thenMochaDone");

function writeStringToParser(parser, str) {
    return parser.write(new Buffer(str));
}

describe("HTTPParser", function () {
    it("parses a GET", function (done) {
        var parser = new HTTPParser();
        var timely = false;
        parser.on('request', function (req) {
            if (timely) {
                try {
                    assert.equal(req.url, "/zoinx");
                    assert.equal(req.headers.host, "zoinx.org");
                    done();
                } catch (e) {
                    done(e);
                }
            } else {
                done(new Error("not timely"));
            }
        });
        writeStringToParser(parser, "GET /zoinx HTTP/1.1\r\n");
        writeStringToParser(parser, "Host: zoinx.org\r\n");
        timely = true;
        writeStringToParser(parser, "\r\n");
    });
    it("parses two GETs back to back", function (done) {
        function writeOneRequest(parser) {
            writeStringToParser(parser, "GET /zoinx HTTP/1.1\r\n" +
                "Host: zoinx.org\r\n\r\n");
        }
        var parser = new HTTPParser();
        var count = 0;
        parser.on('request', function () {
            count += 1;
            if (count == 2) {
                done();  // Ah, ah, ah !!!
            }
        });
        writeOneRequest(parser);
        writeOneRequest(parser);
    });
    it("parses a POST with a body, and resumes parsing GETs", function (done) {
        var foundPOST = Q.defer(), foundGET = Q.defer();
        Q.all([foundPOST.promise, foundGET.promise]).thenMochaDone(done);

        var parser = new HTTPParser();
        parser.on('request', function (req) {
            if (req.method === "POST") {
                try {
                    assert.equal(req.url, "/zoinx");
                    assert.equal(req.headers.host, "zoinx.org");
                    var buf = "";
                    req.on("data", function (txt) {
                        buf += txt;
                    });
                    req.on("end", function () {
                        try {
                            assert.equal(buf, "ZOINX");
                        } catch (e) {
                            foundPOST.reject(e);
                        }
                        foundPOST.resolve();
                    });
                } catch (e) {
                    foundPOST.reject(e);
                }
            } else {
                try {
                    assert.equal(req.url, "/zoinx");
                    assert.equal(req.headers.host, "zoinx.org");
                    foundGET.resolve();
                } catch (e) {
                    foundGET.reject(e);
                }
            }
        });
        writeStringToParser(parser,
            "POST /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n" +
            "Content-Length: 5\r\n" +
            "\r\n" +
            "ZOINX" +  // Note conspicuous lack of \r\n
            "GET /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n\r\n");
    });
    it("closes cleanly", function (done) {
        var parser = new HTTPParser();
        parser.on("request", function() {done()});
        writeStringToParser(parser, "GET /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n\r\n");
        parser.end();
    });
    it("deals with parse errors", function (done) {
        var parser = new HTTPParser();
        parser.on("request", function () {
            done(new Error("This sure shouldn't parse"));
        });
        parser.on("error", function () {
            done();
        });
        writeStringToParser(parser, "GET\r\n" +
            "Host: zoinx.org\r\n\r\n");
        parser.end();
    });
});

function checkThenDone(checks, done) {
    return function() {
        try {
            checks.apply(this, Array.prototype.slice.apply(arguments));
            done();
        } catch (e) {
            done(e);
        }
    };
}

describe("http_on_pipe", function () {
    function makeStringSource(readBuf) {
        var source = new Readable();
        source._read = function () {
            source.push(readBuf);
            readBuf = null;
        };
        return source;
    }

    function makeStringSink() {
        var sink = new Writable();
        sink.buf = "";
        sink._write = function (data, encoding, cb) {
            sink.buf += data;
            debug("sink.buf is now " + sink.buf.length + " bytes long");
            cb();
        };
        return sink;
    }

    function bogoServe(req, res) {
        debug("bogoServing");
        res.setHeader("Content-Type", "text/plain");
        res.write("This is a " + req.method + " on " + req.url + "\n");
        res.end();
    }

    it("serves", function (done) {
        var src = makeStringSource("GET /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n\r\n");
        var sink = makeStringSink();
        http_on_pipe(src, sink, bogoServe,
            checkThenDone(function (err) {
                assert.equal(err, undefined);
                assert(sink.buf.toString().match("This is a GET on /zoinx"));
            }, done));
    });
    it("serves POSTs (and then GETs)", function (done) {
        var src = makeStringSource(
            "POST /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n" +
            "Content-Length: 5\r\n" +
            "\r\n" +
            "ZOINX" +  // Note conspicuous lack of \r\n
            "GET /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n\r\n");
        var sink = makeStringSink();
        http_on_pipe(src, sink, bogoServe,
            checkThenDone(function (err) {
                assert.equal(err, undefined);
                assert(sink.buf.toString().match(
                    /This is a POST on \/zoinx[\s\S]*This is a GET on \/zoinx/));
            }, done));
    });
    it("deals with parse errors", function (done) {
        var src = makeStringSource("GET\r\n" +
            "Host: zoinx.org\r\n\r\n");
        var sink = makeStringSink();
        http_on_pipe(src, sink, bogoServe,
            checkThenDone(function (err) {
                assert.equal(err.message, "Parse Error");
            }, done));
    });
    it("deals with EPIPE", function (done) {
        var src = makeStringSource("GET /zoinx HTTP/1.1\r\n" +
            "Host: zoinx.org\r\n\r\n");
        var brokenSink = new Writable();
        brokenSink._write = function (chunk, encoding, callback) {
            debug("Ehh, no piping");
            callback(new Error("EPIPE"));
        };
        http_on_pipe(src, brokenSink, bogoServe,
            checkThenDone(function (err) {
                assert.equal(err.message, "EPIPE");
            }, done));
    });
    it("deals with errors thrown in the handler");
});

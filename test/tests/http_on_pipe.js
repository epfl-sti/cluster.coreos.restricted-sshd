/**
 * Tests over http_on_pipe.js
 */

var assert = require("assert"),
    Q = require("q"),
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
    xit("deals with parse errors", function () {
        var parser = new HTTPParser();
        writeStringToParser(parser, "GET\r\n" +
            "Host: zoinx.org\r\n\r\n");
        parser.end();
        parser.on("request", function () {
            done(new Error("This sure shouldn't parse"));
        });
        parser.on("error", function () {
            done();
        })
    });
});
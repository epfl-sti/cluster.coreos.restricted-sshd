'use strict';
var assert = require("assert"),
    which = require("which"),
    express = require('express'),
    express_json = require('express-json'),
    request = require("request"),
    debug = require("debug")("tests/sshd.js"),
    keys = require("../../keys"),
    sshd = require("../../sshd"),
    TestSshServer = require('../sshd').TestServer,
    testKeys = require('../keys'),
    command = require("../shell-command"),
    FakeFleetd = require("../fleetd").FakeFleetd,
    Agent = require("../ssh-agent").Agent;

require("../thenMochaDone");

var fleetctl;
try {
    fleetctl = which.sync("fleetctl");
} catch (e) {
    debug("No fleetctl in PATH, some tests will be skipped")
}

describe('sshd end-to-end test', function () {
    if (! fleetctl) return;
    var fakeFleetd = new FakeFleetd;
    var server = new TestSshServer(fakeFleetd);
    server.before(before);

    it("runs fleetctl list-machines", function (done) {
        var fakeUserKey = new testKeys.UserKey();
        var hasAccess = new keys.UserPublicKey(fakeUserKey.publicAsSshString());
        server.server.findPolicy = function (username, pubkey) {
            if (! hasAccess.equals(pubkey)) return;
            var policy = new sshd.Policy("test pubkey");
            policy.fleetAPI = express();
            policy.fleetAPI.use(express_json());
            policy.fleetAPI.get("/fleet/v1/machines", function (req, res, next) {
                request("http://unix:" + fakeFleetd.socketPath +
                    ":/fleet/v1/machines", function (err, unusedres, body) {
                    debug(body);
                    res.json(JSON.parse(body));
                });
            });
            return policy;
        };
        var agent = new Agent();
        agent.addKey(fakeUserKey).then(function () {
            return command("fleetctl", ["--tunnel", "localhost:" + server.port,
                    "--known-hosts-file", server.knownHostsFilePath, "list-machines"],
                agent.getEnv());
        }).then(function (stdout) {
            assert(stdout.match(/region=epflsti-ne-cloud/));
        }).thenMochaDone(done);
    });
});

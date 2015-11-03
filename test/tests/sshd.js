'use strict';
var assert = require("assert"),
    which = require("which"),
    express = require('express'),
    debug = require("debug")("tests/sshd.js"),
    keys = require("../../keys"),
    sshd = require("../../sshd"),
    TestSshServer = require('../sshd').TestServer,
    testKeys = require('../keys'),
    command = require("../shell-command"),
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
    var server = new TestSshServer;
    server.before(before);

    it("runs fleetctl list-machines", function (done) {
        var fakeUserKey = new testKeys.UserKey();
        var hasAccess = new keys.UserPublicKey(fakeUserKey.publicAsSshString());
        server.server.findPolicy = function (pubkey) {
            if (! hasAccess.equals(pubkey)) return;
            var policy = new sshd.Policy("test pubkey");
            policy.fleetConnect = express();
            // policy.fleetConnect.use(express_json);
            policy.fleetConnect.get("/fleet/v1/machines", function (req, res, next) {
                var responseData = {"machines":
                    [{"id":"08160786f7c24ee495fca0b56301397a","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.3"}]};
                res.setHeader("Content-Type", "application/json");
                res.write(JSON.stringify(responseData));
                res.end();
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

'use strict';
var assert = require("assert"),
    which = require("which"),
    request = require("request"),
    debug = require("debug")("tests/sshd.js"),
    keys = require("../../keys"),
    FilteringPolicy = require("../../policy").FilteringPolicy,
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

    var fakeUserKey = new testKeys.UserKey();
    var hasAccess = new keys.UserPublicKey(fakeUserKey.publicAsSshString());

    var fakeFleetd = new FakeFleetd;
    var server = new TestSshServer(fakeFleetd);
    server.server.findPolicy = function (username, pubkey) {
        if (! hasAccess.equals(pubkey)) return;
        var policy = new FilteringPolicy("test pubkey",
            fakeFleetd.socketPath);
        policy.handleExec = function (pty, stream, command) {
            this.runPtyCommand(pty, stream, "bash", ["-c", command]);
        };
        policy.isUnitAllowed = function (unitName) {
            return (unitName === "stiitops.prometheus.service");
        };
        return policy;
    };
    server.before(before);

    var agent = new Agent();
    before(function (done) {
        agent.addKey(fakeUserKey).thenMochaDone(done);
    });

    function fleetctl(args) {
        args = Array.prototype.concat.call(
            ["--tunnel", "localhost:" + server.port,
            "--known-hosts-file", server.knownHostsFilePath],
            args);
        return command("fleetctl", args, agent.getEnv());
    }

    it("runs fleetctl list-machines", function (done) {
        fleetctl(["list-machines"]).then(function (stdout) {
            assert(stdout.match(/region=epflsti-ne-cloud/));
        }).thenMochaDone(done);
    });

    describe("fleetctl ssh", function () {
        before(function (done) {
            server.appendKnownHost("192.168.11.9").thenMochaDone(done);
        });
        it("runs a command that exits successfully", function (done) {
            fleetctl(["ssh", "stiitops.prometheus.service", "echo", "hello"])
                .then(function (stdout) {
                    assert(stdout.match(/hello/));
                }).thenMochaDone(done);
        });
        it("propagates exit codes", function (done) {
            fleetctl(["ssh", "stiitops.prometheus.service", "exit", "42"])
                .then(function (stdout) {
                    done("Should have thrown");
                }, function (err) {
                    assert.strictEqual(err.exitCode, 42);
                }).thenMochaDone(done);
        });
    });
});

/**
 * Testable sshd server.
 */
var fs = require("fs"),
    path = require("path"),
    Q = require("q"),
    tmp = require("tmp"),
    keys = require("./keys"),
    sshd = require("../sshd");
require("./thenMochaDone");

var TestServer = exports.TestServer = function (fakeFleetd) {
    this.hostKey = new keys.HostKey();
    this.server = new sshd.Server({
        privateKey: this.hostKey.privateAsX509String()
    });
    this.fakeFleetd = fakeFleetd;
};

TestServer.prototype.before = function (before) {
    var self = this;
    before(function (done) {
        self.fakeFleetd.started.then(
            Q.nfcall(self.server.listen)
                .then(function () {
                    self.port = self.server.address().port;
                    return Q.nfcall(tmp.dir);
                }).then(function (dir_and_callback) {
                    var dir = dir_and_callback[0];
                    self.knownHostsFilePath = path.join(dir, "known_hosts");
                    return self.appendKnownHost("[127.0.0.1]:" + self.port);
                }).thenMochaDone(done)
        );
    });
};

TestServer.prototype.appendKnownHost = function (address) {
    return Q.nfcall(fs.appendFile, this.knownHostsFilePath,
        address + " " + this.hostKey.publicAsSshString() + "\n");
};

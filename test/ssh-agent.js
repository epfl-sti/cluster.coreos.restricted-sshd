/**
 * Test ssh agent.
 */

var net = require("net"),
    Q = require("q"),
    merge = require("merge"),
    command = require("./shell-command"),
    debug = require("debug")("ssh-agent");

function waitSocketActive(socketPath) {
    var isActive = Q.defer();
    var maxTime = (new Date().getTime()) + 10 * 1000;
    var cancellable;
    cancellable = setInterval(function () {
        if ((new Date().getTime()) > maxTime) {
            isActive.reject(new Error("Timeout"));
        }
        var client = net.connect({path: socketPath});
        client.on("error", function (error) {
            clearInterval(cancellable);
            isActive.reject(error);
        });
        client.on("connect", function () {
            debug("Success connecting to socket " + socketPath + ", agent is ready!");
            clearInterval(cancellable);
            isActive.resolve();
        });
    }, 100);
    return isActive.promise;
}

/**
 *
 * @constructor
 */
var Agent = exports.Agent = function () {
    var self = this;
    var sshAgentPath;
    self._started = command("ssh-agent").then(function (stdout) {
        var matched = stdout.match(/SSH_AUTH_SOCK=([^;]+)/);
        if (matched) {
            self.agentSocketPath = matched[1];
        } else {
            throw new Error(buf);
        }
    }).then(function () {
        return waitSocketActive(self.agentSocketPath);
    });
};

Agent.prototype.addKey = function (key) {
    var self = this;
    return Q.all([self._started,
        key.promiseSave()]).then(function (promised) {
        var privatePath = promised[1].private;
        return command("ssh-add", [privatePath], self.getEnv());
    });
};

Agent.prototype.getEnv = function () {
    return merge(process.env, {"SSH_AUTH_SOCK": this.agentSocketPath});
};

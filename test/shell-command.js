/**
 * Promise that a shell command runs successfully.
 *
 * The promise value is the aggregated stdout output as a string.
 */
var Q = require('q'),
    spawn = require("child_process").spawn,
    debug = require("debug")("shell-command"),
    inspect = require("util").inspect;

module.exports = function (command, args, env) {
    debug(command + " " + args + " with env " + inspect(env));
    if (args === undefined) args = [];
    var opts = { stdio: ['inherit', 'pipe', 'inherit'] };
    if (env !== undefined) opts.env = env;
    var spawned = spawn(command, args, opts);
    var processExitedOK = Q.defer();
    var stdoutClosed = Q.defer();

    var buf = "";
    spawned.stdout.on("data", function (data) {
        buf = buf + data;
    });
    spawned.stdout.on("error", function (err) {
        stdoutClosed.reject(err);
    });
    spawned.stdout.on("end", function (err) {
        stdoutClosed.resolve(buf);
    });
    spawned.on("exit", function (exitCode, signal) {
        if (exitCode !== 0) {
            processExitedOK.reject(new Error(command + " exited with status " + exitCode));
        } else if (signal) {
            processExitedOK.reject(new Error(command + " exited with signal " + signal));
        } else {
            processExitedOK.resolve();
        }
    });
    return Q.all([processExitedOK.promise, stdoutClosed.promise]).then(function () {
        return buf;
    });
};
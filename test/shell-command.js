/**
 * Promise that a shell command runs successfully.
 *
 * The promise value is the aggregated stdout output as a string.
 */
var Q = require('q'),
    spawn = require("child_process").spawn,
    debug = require("debug")("tests/shell-command"),
    inspect = require("util").inspect;

module.exports = function (command, args, env) {
    debug(command + " " + args + " with env " + inspect(env));
    if (args === undefined) args = [];
    var opts = { stdio: ['inherit', 'pipe', 'inherit'] };
    opts.env = (env !== undefined) ? env : {
            PATH: process.env.PATH,
            HOME: process.env.HOME
        };
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
        var error;
        if (exitCode !== 0) {
            error = new Error(command + " exited with nonzero exit code");
            error.exitCode = exitCode;
            processExitedOK.reject(error);
        } else if (signal) {
            error = new Error(command + " exited with signal");
            error.signal = signal;
            processExitedOK.reject(error);
        } else {
            processExitedOK.resolve();
        }
    });
    return Q.all([processExitedOK.promise, stdoutClosed.promise]).then(function () {
        return buf;
    });
};

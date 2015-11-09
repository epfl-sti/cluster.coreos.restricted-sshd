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
    var opts = { stdio: ['inherit', 'pipe', 'pipe'] };
    opts.env = (env !== undefined) ? env : {
            PATH: process.env.PATH,
            HOME: process.env.HOME
        };
    var spawned = spawn(command, args, opts);
    var processExited = Q.defer(),
        stdoutClosed = Q.defer(),
        stderrClosed = Q.defer();

    var stdoutBuf = "", stderrBuf = "";
    spawned.stdout.on("data", function (data) {
        stdoutBuf += data;
    });
    spawned.stdout.on("error", function (err) {
        stdoutClosed.reject(err);
    });
    spawned.stdout.on("end", function (err) {
        stdoutClosed.resolve(stdoutBuf);
    });
    spawned.stderr.on("data", function (data) {
        stderrBuf += data;
    });
    spawned.stderr.on("error", function (err) {
        stderrClosed.reject(err);
    });
    spawned.stderr.on("end", function (err) {
        stderrClosed.resolve(stderrBuf);
    });

    var exitCode, signal;
    spawned.on("exit", function (theExitCode, theSignal) {
        exitCode = theExitCode;
        signal = theSignal;
        processExited.resolve();
    });
    return Q.all([processExited.promise, stdoutClosed.promise,
        stderrClosed.promise]).then(function () {
        var error;
        if (exitCode !== 0) {
            error = new Error(command + " exited with nonzero exit code");
            error.exitCode = exitCode;
            error.stderr = stderrBuf;
            throw error;
        } else if (signal) {
            error = new Error(command + " exited with signal");
            error.signal = signal;
            error.stderr = stderrBuf;
            throw error;
        }
        if (stderrBuf) { debug(stderrBuf); }
        return stdoutBuf;
    });
};

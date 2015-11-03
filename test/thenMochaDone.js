/**
 * Pipe together promises and mocha.
 */

var Q = require("q");

Promise.prototype.thenMochaDone = Q.makePromise.prototype.thenMochaDone = function (done) {
    this.then(
        function () {
            done()
        }, function (error) {
            done(error);
        });
};


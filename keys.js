/**
 * Manage public and private keys: parse, convert etc.
 */

var ssh2 = require('ssh2'),
    utils = ssh2.utils,
    buffersEqual = require('buffer-equal-constant-time');

/**
 *
 * @param sshString E.g. "ssh-rsa AAAABBBB123 me@example.com"
 * @constructor
 */
var UserPublicKey = exports.UserPublicKey = function (sshString) {
    this._sshString = sshString;
};

UserPublicKey.prototype.toString = function() {
    return this._sshString;
};

UserPublicKey.prototype._getParsed = function () {
    if (! this._parsed) {
        this._parsed = utils.genPublicKey(utils.parseKey(this.toString()));
    }
    return this._parsed;
};

UserPublicKey.prototype.getFullType = function () {
    return this._getParsed().fulltype;
};

UserPublicKey.prototype.getPublicString = function () {
    return this._getParsed().public;
};

UserPublicKey.prototype.equals = function (cmp) {
    if (cmp.algo && cmp.data) {
        return (cmp.algo === this.getFullType()
            && buffersEqual(cmp.data, this.getPublicString()));
    }
};

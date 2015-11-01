var fs = require('fs'),
    docoptmd = require('docoptmd'),
    sshd = require('./sshd');

var argv = process.argv.slice(process.argv[0].endsWith("/node") ? 2 : 1);
var options = docoptmd(__dirname, {argv: argv});

var sshdPort = options["--port"];
var server = new sshd.Server({
        privateKey: fs.readFileSync('tmpkeys/host_rsa_key'),
    });

var buffersEqual = require('buffer-equal-constant-time'),
    ssh2 = require('ssh2'),
    utils = ssh2.utils;
var pubKey = utils.genPublicKey(utils.parseKey(fs.readFileSync('tmpkeys/user.pub')));

server.findPolicyByPubkey = function (key) {
    if (key.algo === pubKey.fulltype
        && buffersEqual(key.data, pubKey.public)) {
        var policy = new sshd.Policy("tmpkeys/user.pub");
        return policy;
    }
};

server.listen({port: sshdPort},
    function() {
        console.log("Running on port " + this.address().port);
    });

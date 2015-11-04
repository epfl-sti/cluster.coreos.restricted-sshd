var fs = require('fs'),
    docoptmd = require('docoptmd'),
    express = require('express'),
    express_json = require('express-json'),
    debug = require("debug")("restricted-sshd"),
    keys = require("./keys"),
    sshd = require('./sshd'),
    fake_fleetd = require("./test/fleetd"),
    fakeAPIResponses = fake_fleetd.fakeAPIResponses;

var argv = process.argv.slice(process.argv[0].endsWith("/node") ? 2 : 1);
var options = docoptmd(__dirname, {argv: argv});

var sshdPort = options["--port"];
var server = new sshd.Server({
        privateKey: fs.readFileSync('tmpkeys/host_rsa_key'),
    });

var buffersEqual = require('buffer-equal-constant-time'),
    ssh2 = require('ssh2'),
    utils = ssh2.utils;
var hasAccess = new keys.UserPublicKey(fs.readFileSync(process.env.HOME + '/.ssh/id_rsa.pub'));

server.findPolicy = function (username, pubkey) {
    // TODO: improve - One ACL of SSH keys per tenant.
    // (The tenant name is the --ssh-username passed to fleetctl; not sure
    // how to fetch that from ssh2 API, must be passed to findPolicy)
    if (! hasAccess.equals(pubkey)) return;

    var policy = new sshd.Policy(username + "'s id_rsa.pub");
    policy.fleetConnect = express();
    policy.fleetConnect.use(express_json());
    policy.fleetConnect.get("/fleet/v1/machines", function (req, res, next) {
        res.json(fakeAPIResponses.machines);
    });
    policy.fleetConnect.get("/fleet/v1/units/:unit", function (req, res, next) {
        var unit = req.params.unit;
        debug("/fleet/v1/units/" + unit);

        res.json(fakeAPIResponses.unit_stiitops_prometheus_service);
    });
    return policy;
};

server.listen({port: sshdPort},
    function() {
        console.log("Running on port " + this.address().port);
    });

fake_fleetd.listen(function () {
    console.log("Fake fleetd available on UNIX socket " + this.socketPath);
});
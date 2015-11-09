var fs = require('fs'),
    docoptmd = require('docoptmd'),
    Q = require("q"),
    keys = require("./keys"),
    sshd = require('./sshd'),
    FilteringPolicy = require("./policy").FilteringPolicy,
    FakeFleetd = require("./test/fleetd").FakeFleetd;

require('./exceptions');

var argv = process.argv.slice(process.argv[0].endsWith("/node") ? 2 : 1);
var options = docoptmd(__dirname, {argv: argv});

var sshdPort = options["--port"];
var server = new sshd.Server({
        privateKey: fs.readFileSync('tmpkeys/host_rsa_key')
    });

var hasAccess = new keys.UserPublicKey(fs.readFileSync(process.env.HOME + '/.ssh/id_rsa.pub'));

var fleetdSocketPath = "/var/run/fleet.sock";

server.findPolicy = function (username, pubkey) {
    // TODO: improve - One ACL of SSH keys per tenant.
    if (! hasAccess.equals(pubkey)) return;

    var policy = new FilteringPolicy(username + "'s id_rsa.pub", fleetdSocketPath);
    policy.isUnitAllowed = function (fleetUnitName) {
        return fleetUnitName.startsWith("stiitops.");
    };
    return policy;
};

function setupDevEnvironment() {
    if (process.env.NODE_ENV === "production") { return; }
    var fake_fleetd = new FakeFleetd();
    return fake_fleetd.started.then(function () {
        fleetdSocketPath = fake_fleetd.socketPath;
        console.log("Fake fleetd serving on UNIX socket " + fleetdSocketPath);
    });
}

Q.when(setupDevEnvironment()).then(function () {
    return Q.nfcall(server.listen, {port: sshdPort});
}).then(function () {
    console.log("Restricted sshd serving on port " + server.address().port);
});

var fs = require('fs'),
    docoptmd = require('docoptmd'),
    express = require('express'),
    express_json = require('express-json'),
    debug = require("debug")("restricted-sshd"),
    keys = require("./keys"),
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
var hasAccess = new keys.UserPublicKey(fs.readFileSync('tmpkeys/user.pub'));

server.findPolicyByPubkey = function (pubkey) {
    if (hasAccess.equals(pubkey)) {
        var policy = new sshd.Policy("tmpkeys/user.pub");
        policy.fleetConnect = express();
        // policy.fleetConnect.use(express_json);
        policy.fleetConnect.get("/fleet/v1/machines", function (req, res, next) {
            var responseData = {"machines":[{"id":"08160786f7c24ee495fca0b56301397a","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.3"},{"id":"1cc5e2d0164446f48535cd3664d71350","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.9"},{"id":"20ddd26b8f7e4627a3bf3c764aa18882","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.11"},{"id":"21efe06140bd49adb83b66d05628fbe6","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.5"},{"id":"23d18b00095749d9825fe00b61e80cfc","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.8"},{"id":"261d935d997b409c9558fa407af8e794","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.17"},{"id":"2ef2b172e5ed4db9bc0704d542047378","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.44"},{"id":"2f76392dff9f41298a4b90c61cdd10ef","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.7"},{"id":"4dc69321a26646caa263b32d5c04389b","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.35"},{"id":"5358717ab55545ce8b41d5dd91fb29df","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.67"},{"id":"5a8b7e48927e4564b2a69def3f02fa11","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.19"},{"id":"5b572788d02847bba286a617063e4079","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.4"},{"id":"6441e5a6c008462892b7eae002315981","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.2"},{"id":"66cf92b0c87f4292b6bc5e3f5708cd87","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.36"},{"id":"75d482cab13341aaa92d2b61a8b3c812","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.29"},{"id":"7e4a69a70a994b58b8db85093bcdc881","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.1"},{"id":"7f3bac03579f41e9bb41b9d796393cc4","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.38"},{"id":"81227a4a33d54791abddcea5c6a2feba","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.20"},{"id":"8d0ca764aabd4a1caf0644a7e1ad6c39","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.32"},{"id":"9492c79eeeca435fb14042e69072d4ed","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.31"},{"id":"99f048ef463147418aa13d3e60da95d5","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.33"},{"id":"a613c6708fa54f5a87e70b002ff577e3","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.61"},{"id":"b001af67457646c78d2db3ea67bf46b3","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.6"},{"id":"b3fd02df77ea4345972e155e1f5370e8","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.10"},{"id":"b4f2ae0e6c32400cb5abdc3ad9b0b532","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.47"},{"id":"b8878be40fb441cdbcdb2882aa38078e","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.68"},{"id":"bca95227891e46d29d89c7eddd2d1eac","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.37"},{"id":"c4d3747f4fe44185ad57e5fc0dc59171","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.30"},{"id":"cbf1f802976b4cc9a13d2259f97d9b28","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.12"},{"id":"ee07e725c6764ae78c91d3a291ce0754","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.22"},{"id":"f984a9efac974817aba4feb03d9fa98e","metadata":{"has_ups":"true","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.45"},{"id":"fd9192ed66fe42b683a77e435f902c39","metadata":{"has_ups":"false","region":"epflsti-ne-cloud"},"primaryIP":"192.168.11.65"}]};
            // res.json(responseData);
            res.setHeader("Content-Type", "application/json");
            res.write(JSON.stringify(responseData));
            res.end();
        });
        policy.fleetConnect.get("/fleet/v1/units/:unit", function (req, res, next) {
            var unit = req.params.username;
            debug("/fleet/v1/units/" + unit);

            var responseData = {"currentState":"launched","desiredState":"launched","machineID":"1cc5e2d0164446f48535cd3664d71350","name":"stiitops.prometheus.service","options":[{"name":"Description","section":"Unit","value":"Prometheus service"},{"name":"After","section":"Unit","value":"docker.service"},{"name":"Requires","section":"Unit","value":"docker.service"},{"name":"ExecStartPre","section":"Service","value":"/bin/sh -c 'docker rm -f %n 2\u003e/dev/null || true'"},{"name":"ExecStartPre","section":"Service","value":"/usr/bin/docker pull docker-registry.ne.cloud.epfl.ch:5000/cluster.coreos.prometheus"},{"name":"ExecStart","section":"Service","value":"/bin/sh -c 'docker run --name %n -p 9090:9090 docker-registry.ne.cloud.epfl.ch:5000/cluster.coreos.prometheus'"},{"name":"ExecStop","section":"Service","value":"/usr/bin/docker rm -f %n"},{"name":"RestartSec","section":"Service","value":"5s"},{"name":"Restart","section":"Service","value":"always"}]};
            // res.json(responseData);
            res.setHeader("Content-Type", "application/json");
            res.write(JSON.stringify(responseData));
            res.end();

        });
        return policy;
    }
};

server.listen({port: sshdPort},
    function() {
        console.log("Running on port " + this.address().port);
    });


var express = require('express');
var app = express();

app.listen(3000);

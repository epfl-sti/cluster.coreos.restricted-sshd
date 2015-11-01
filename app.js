var docoptmd = require('docoptmd'),
    sshd = require('./sshd');

var argv = process.argv.slice(process.argv[0].endsWith("/node") ? 2 : 1);
var options = docoptmd(__dirname, {argv: argv});

var sshdPort = options["--port"];
var server = sshd.startServer(sshdPort, function() {
    console.log("Running on port " + this.address().port);
});

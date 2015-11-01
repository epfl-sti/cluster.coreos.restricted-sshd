var docoptmd = require('docoptmd');

var argv = process.argv.slice(process.argv[0].endsWith("/node") ? 2 : 1);
var options = docoptmd(__dirname, {argv: argv});

console.log("Running on port " + options["--port"]);

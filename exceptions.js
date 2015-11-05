/**
 * Do something about "error" events crashing the whole app.
 *
 * http://stackoverflow.com/a/16950737 says that we basically have
 * the choice between longjohn and a catch-all handler. Do either-or
 * depending on the NODE_ENV variable of
 * http://stackoverflow.com/questions/16978256 fame.
 */

exports.uncaughtExceptionCount = 0;

if (process.env.NODE_ENV === "production") {
    process.on('uncaughtException', function (error) {
        console.log("UNCAUGHT EXCEPTION: " + error + error.stack);
        exports.uncaughtExceptionCount += 1;  // For Prometheus
    })
} else {
    // "Shanna, they bought their tickets, they knew what they were getting
    // into. I say, let 'em crash" – But with  stack traces, ARRRRRR!!
    require("longjohn");
}

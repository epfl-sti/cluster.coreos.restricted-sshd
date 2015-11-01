/**
 * sshd entry point, using based on https://github.com/mscdex/ssh2
 */

var assert = require('assert'),
    crypto = require('crypto'),
    inspect = require('util').inspect,
    debug = require('debug')('sshd'),
    ssh2 = require('ssh2');

/**
 * A policy object.
 *
 * Methods decide what happens in various circumstances; they should be
 * overridden.
 *
 * @constructor
 */
var Policy = exports.Policy = function (id) {
    this.debug = function(msg) { debug(id + ": " + msg); };

    this.grantFleetSock = function (stream) {
        stream.stderr.write('Oh no, the dreaded errors!\n');
        stream.write('Just kidding about the errors!\n');
        stream.exit(0);
        stream.end();
    };
};

/**
 * Server class.
 *
 * The server does nothing by default; some of its methods must be overridden.
 *
 * @param options Options dict
 * @param options.privateKey The server's private key as text
 * @constructor
 */
var Server = exports.Server = function (options) {
    var self = this;

    server = new ssh2.Server({
        privateKey: options.privateKey
    }, function (client) {
        debug('New client connection');

        client.on('authentication', function (ctx) {
            if (ctx.method === 'publickey') {
                if (! client.policy) {
                    client.policy = self.findPolicyByPubkey(ctx.key);
                    if (! client.policy) {
                        debug("Presented unacceptable key");
                        ctx.reject();
                        return;
                    }
                }
                if (! ctx.signature) {
                    // if no signature present, that means the client is just checking
                    // the validity of the given public key
                    ctx.accept();
                } else {
                    var verifier = crypto.createVerify(ctx.sigAlgo);
                    verifier.update(ctx.blob);
                    if (verifier.verify(client.policy.publicOrig,
                            ctx.signature, 'binary')) {
                        client.policy.debug("Public key authentication successful");
                        ctx.accept();
                    } else {
                        client.policy.debug("Failed pubkey authentication");
                        ctx.reject();
                    }
                }
            } else if (ctx.method === 'none') {
                // Client wants list of authentication methods
                // (RFC4525, § 5.2)
                ctx.reject(["publickey"]);
            } else
                ctx.reject();
        });
        client.on('ready', function () {
            client.policy.debug('Client authenticated!');

            client.on('session', function (accept, reject) {
                client.policy.debug('Client requests a session');

                var session = accept();
                session.once('exec', function (accept, reject, info) {
                    client.policy.debug('Client wants to execute: ' +
                        inspect(info.command));
                    if (info.command.indexOf("fleetctl fd-forward") > -1 &&
                        info.command.indexOf("fleet.sock") > -1) {
                        client.policy.debug("Routing to restricted fleet.sock");
                        var stream = accept();
                        client.policy.grantFleetSock(stream);
                    } else {
                        client.policy.debug("Unhandled command: " +
                            inspect(info.command));
                        reject();
                    }
                });
                session.on('subsystem', function (accept, reject, info) {
                    client.policy.debug('Client invokes a subsystem');
                    reject();
                });
                session.on('auth-agent', function (accept, reject, info) {
                    client.policy.debug('Client wants to forward agent');
                    accept();
                });
            });
        });
        client.on('tcpip', function (accept, reject, info) {
            client.policy.debug('Client wants to forward TCP');
            reject();
        });
        client.on('openssh.streamlocal', function (accept, reject, info) {
            client.policy.debug('Client wants to forward a stream');
            reject();
        });
        client.on('end', function () {
            if (client.policy) {
                client.policy.debug('Client disconnected');
            } else {
                debug('Unauthenticated client disconnected');
            }
        });
    });

    self.listen = server.listen.bind(server);

    /**
     * Overridable method: find a policy for a given public key
     * @param key
     * @returns Policy instance, or undefined
     */
    self.findPolicyByPubkey = function (key) {};
};

/**
 * Create and .listen()s a Server and return it.
 *
 * @param opt_options An options dict (optional; passed to constructor)
 * @param opt_options.listenAddress The local IP address to listen on; default ''
 * @param opt_options.port The server port (picked automatically by default)
 * @param done Callback invoked when the server socket is ready
 * @returns {Server}
 */
exports.startServer = function(opt_options, done) {
    if (done === undefined) {
        done = opt_options;
        opt_options = {};
    }
    var server = new Server(opt_options);
    server.listen(opt_options.port === undefined ? 0 : opt_options.port,
        opt_options.listenAddress === undefined ? '': opt_options.listenAddress,
        done);

    return server;
};

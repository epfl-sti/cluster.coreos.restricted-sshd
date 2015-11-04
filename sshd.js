/**
 * sshd entry point, built upon https://github.com/mscdex/ssh2
 */

var crypto = require('crypto'),
    inspect = require('util').inspect,
    debug = require('debug')('sshd'),
    ssh2 = require('ssh2'),
    utils = ssh2.utils,
    http_on_pipe = require("./http_on_pipe");

/**
 * A policy object.
 *
 * Methods decide what to do in response to the fleetctl client's actions;
 * a number of them are meant to be overridden.
 *
 * An instance lasts as long as the SSH session, and mutates its own state
 * to keep track of the previous requests in the same session. This allows the
 * routing of e.g. "fleetctl ssh" and "fleetctl journal" to be overridden by
 * the policy, disregarding the IP and port the client *thinks* they should go
 * to.
 *
 * @constructor
 */
var Policy = exports.Policy = function (id) {
    var self = this;

    /**
     * A moniker for debug messages.
     */
    self.id = id;

    /**
     * The sshd.Server instance this policy object belongs to.
     *
     * Set by owner before invoking any methods. Needed by
     * {@link handleTCPForward}.
     *
     * @type {Server}
     */
    self.server = undefined;

    /**
     * The public key that was wielded to unlock this policy.
     *
     * Set by owner before invoking any methods.
     */
    self.publicKey = undefined;

    self.handleFleetStream = function (stream) {
        var closed;
        function close(error) {
            if (closed) return;
            stream.exit(error ? 2 : 0);
            stream.end();
        }
        stream.on("close", close);

        http_on_pipe(stream.stdin, stream.stdout,
            function(req, res) { self.fleetAPI(req, res); },
            close);
    };

    /**
     * The connect or express app to handle the requests to fleetd.
     *
     * The default app is 404-compliant. You probably want to replace it.
     *
     * @type {Function}
     */
    self.fleetAPI = function (req, res) {
        debug("Hit default fleetd handler - Override me in your code");
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.write("No handler is set for requests to " +
            "the restricted fleetd UNIX domain socket");
        res.end();
    };

    /**
     * Loop back TCP forwards to ourselves.
     *
     * The only known reason at this time that fleetctl wants to forward TCP,
     * is to reach the sshd of a particular node for whatever purpose (e.g.
     * fleetctl ssh, fleetctl journal). To apply a policy to such requests, we
     * have to both terminate these flows as (apparently another) SSH server,
     * and chain the policy information to figure out to which node and Docker
     * container to actually SSH into (disregarding the target of the TCP
     * forwarding request set by the client).
     *
     * @param channel A bidirectional ssh2 channel
     * @param done Callback invoked once the forwarding session is over
     */
    self.handleTCPForward = function (channel, done) {
        self.server.masqueradeSSH(self, function (hiItsMeAgain, initializationError) {
            if (initializationError) {
                done(initializationError);
                return;
            }
            function callDone(opt_error) {
                if (! done) return;
                done(opt_error);
                done = undefined;
            }
            channel.on("error", callDone);
            hiItsMeAgain.on("error", callDone);
            channel.pipe(hiItsMeAgain);
            hiItsMeAgain.pipe(channel);

            // TODO: Figure out which of {channel,hiItsMeAgain}.on({"finish","end"})
            // we need to wait for before calling done().
        });
    };
};

function asPemKey(contextKey) {
    var matched = contextKey.algo.match("ssh-(...)");
    if (! matched) {
        throw new Error("Weird algo: " + contextKey.algo);
    }
    return utils.genPublicKey({type: matched[1],
        public: contextKey.data}).publicOrig;
}

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
    self.config = options;

    var server = new ssh2.Server({
        privateKey: options.privateKey
    }, function (client) {
        client.auth = new Authenticator();
        client.auth.findPolicy = self.findPolicy.bind(self);
        client.auth.attach(client, self);

        // client.auth.attach adds a .debug method:
        client.debug('new connection');

        client.on('ready', function () {
            client.debug('Authentication complete!');

            client.on('session', function (accept, reject) {
                client.debug('Client requests a session');

                var session = accept();
                session.once('exec', function (accept, reject, info) {
                    client.debug('Client wants to execute: ' +
                        inspect(info.command));
                    if (info.command.indexOf("fleetctl fd-forward") > -1 &&
                        info.command.indexOf("fleet.sock") > -1) {
                        client.debug("Routing to restricted fleet.sock");
                        var stream = accept();
                        client.policy.handleFleetStream(stream);
                    } else {
                        client.debug("Unhandled command: " +
                            inspect(info.command));
                        reject();
                    }
                });
                session.on('subsystem', function (accept, reject, info) {
                    client.debug('Client invokes a subsystem');
                    reject();
                });
                session.on('auth-agent', function (accept, reject, info) {
                    client.debug('Client wants to forward agent');
                    accept();
                });
            });
        });
        client.on('tcpip', function (accept, reject, info) {
            client.debug('Client wants to forward TCP ' + inspect(info));
            // ... but we are going to disregard that and just forward to
            // ourselves, so that we can pretend we are the remote node.
            client.policy.handleTCPForward(accept());
        });
        client.on('openssh.streamlocal', function (accept, reject, info) {
            client.debug('Client wants to forward a stream');
            reject();
        });
        client.on('end', function () {
            client.debug("disconnected");
        });
    });

    self.listen = server.listen.bind(server);
    self.address = server.address.bind(server);

    /**
     * Overridable method: find a policy for a given public key
     * @param key
     * @returns Policy instance, or undefined
     *
     * @todo Make asynchronous
     */
    self.findPolicy = function (key) {};

    /**
     * Provide a shim to a mock internal node as a pseudo-socket.
     *
     * This is to intercept fleetctl intending to set up a TCP forward to
     * the SSH server of an internal node, in order to run journalctl there
     * (fleetctl journal) or a shell or arbitrary command (fleetctl ssh).
     * In order to apply a policy to such attempts, we cannot just honor the
     * forwarding request; instead we redirect it to an ad-hoc, local
     * sshd.Server that will act as if it were the remote node to complete
     * fleetctl's attempt (or not, depending on the policy).
     *
     * @param policy The policy object that has the state to second-guess
     *               where exactly fleetctl intends to reach
     * @param {Server~masqueradeSSH~initDoneCallback} done
     */
    self.masqueradeSSH = function(policy, done) {
        // TODO
        // Don't .listen() it; just steal its 'connection' handler
        // Create a fake connection and feed it to the above
        // call done(), wipe hands on pants
        var fakeInternalNode = new ssh2.Server({
            privateKey: self.config.privateKey
        }, function (client) {
            self.auth.debug('set up fake internal node');
            client.auth = new Authenticator();
            client.auth.attach(client, self);
        });
    };
    /**
     * @callback Server~masqueradeSSH~initDoneCallback
     *
     * Invoked as done(error) or done(null, shimSSHStream)
     *
     * @param error The error that occurred trying to set up the shim
     * @param shimSSHStream A duplex stream mimicking a client socket to an
     *                      SSH server (socket-only methods and events are not
     *                      emulated).
     */
};

/**
 * Helper for client.on("authenticate").
 *
 * Only public key authentication is supported, and the user may not
 * switch keys once authenticated. Which public key is accepted for
 * which username is a matter of policy, to be set by overriding
 * the findPolicy method.
 *
 * @constructor
 */
function Authenticator() {
    /**
     * Whether authentication is complete.
     *
     * @type {boolean}
     */
    this.done = false;

    /**
     * The policy object that is being considered for this authentication.
     * @type {Policy}
     */
    this.policy = undefined;
}

/**
 * Take charge of authentication on behalf of `client`
 *
 * Set up a fully functional 'authentication' handler, and a minimalistic
 * 'ready' handler that just sets client.policy. Also alias client.debug
 * to {@link Authenticator~debug}.
 *
 * @param client The client parameter passed down by the ssh2.Server's
 *               listener
 * @param {Server} server
 */
Authenticator.prototype.attach = function(client, server) {
    var self = this;

    client.debug = self.debug;
    client.on('authentication', function (ctx) {
        if (ctx.method === 'none') {
            // Client wants list of authentication methods
            // (RFC4525, § 5.2)
            ctx.reject(["publickey"]);
            return;
        } else if (ctx.method !== 'publickey') {
            reject();
            return;
        }

        var publicKey = asPemKey(ctx.key);
        if (self.publicKey && self.publicKey.toString() !==
            publicKey.toString()) {
            if (self.done) {
                client.debug("not allowed to switch keys after authentication!");
                ctx.reject();
                return;
            } else {
                client.debug("changing keys from " + self.publicKey + " to "
                    + publicKey);
                self.publicKey = undefined;
                self.policy = undefined;
            }
        }
        if (! self.policy) {
            self.policy = self.findPolicy(ctx.username, ctx.key);
            if (! self.policy) {
                client.debug("presented unacceptable key");
                ctx.reject();
                return;
            }
            self.publicKey = publicKey;
        }
        if (! ctx.signature) {
            // if no signature present, that means the client is just checking
            // the validity of the given public key
            client.debug("We will accept this public key");
            ctx.accept();
        } else {
            var verifier = crypto.createVerify(ctx.sigAlgo);
            verifier.update(ctx.blob);
            if (verifier.verify(self.publicKey,
                    ctx.signature, 'binary')) {
                client.debug("Public key authentication successful");
                self.done = true;
                ctx.accept();
            } else {
                client.debug("Failed public key authentication");
                ctx.reject();
            }
        }
    });

    client.on('ready', function () {
        /* Eject the policy towards client object */
        client.policy = self.policy;
        client.policy.server = server;
    });
};

/**
 * Like regular debug, but tag the message with (purported) user ID.
 *
 * @param msg
 */
Authenticator.prototype.debug = function(msg) {
    var id =
        this.policy && this.done ? this.policy.id :
            this.policy ? "?" + this.policy.id + "?":
                "Pre-auth client";
    debug(id + ": " + msg);
};

/**
 * Construct the policy object for this username and key.
 *
 * The default implementation refuses everything, so you probably want to
 * override this.
 *
 * @todo Document; make asynchronous
 */
Authenticator.prototype.findPolicy = function (username, key) {
};

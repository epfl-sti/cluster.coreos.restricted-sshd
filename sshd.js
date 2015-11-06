/**
 * sshd entry point, built upon https://github.com/mscdex/ssh2
 */

var assert = require('assert'),
    crypto = require('crypto'),
    inspect = require('util').inspect,
    debugOrig = require('debug')('sshd'),
    merge = require("merge"),
    ptySpawn = require("pty.js").spawn,
    Q = require("q"),
    ssh2 = require('ssh2'),
    utils = ssh2.utils,
    http_on_pipe = require("./http_on_pipe");

function debug(/* hints..., msg */) {
    if (! debugOrig.enabled) { return; }
    var args = Array.prototype.slice.call(arguments);
    var msg = args.pop();

    while(args.length > 0) {
        var hint = args.pop();
        var label;
        if (hint.getDebugLabel) { label = hint.getDebugLabel(); }
        if (label !== undefined) { msg = "[" + label + "] " + msg; }
    }
    debugOrig(msg);
}

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
    self.getDebugLabel = function() { return "<Policy " + id + ">"; }

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
     * @param client The ssh2.Server's listener parameter
     * @param channel A bidirectional ssh2 channel
     */
    self.handleTCPForward = function (client, channel) {
        self.server.masqueradeSSH(client.policy, channel);
    };

    self.runPtyCommand = function(pty, stream, command, args) {
        var cmd = ptySpawn(command, args, {
            name: pty.term,
            cols: pty.cols,
            rows: pty.rows,
            cwd: "/",
            env: merge(process.env, {TERM: pty.term})
        });
        cmd.pipe(stream); stream.pipe(cmd);
        cmd.on("error", function (err) {
            debug(err);
        });
        stream.on("error", function (err) {
            debug(err);
        });
    };

    self.handleShell = function (pty, stream) {
        stream.write("Connected to /bin/bash.\n");
        stream.write("TODO: should rather ssh somewhere and docker run /bin/sh\n");
        self.runPtyCommand(pty, stream, '/bin/bash', []);
    };

    self.handleExec = function (pty, stream, command) {
        stream.write("Connected to /bin/bash.\n");
        stream.write("TODO: should rather run \"" + inspect(command) + "\"\n");
        self.runPtyCommand(pty, stream, '/bin/bash', []);
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

        debug(client, 'new connection');

        client.on('ready', function () {
            client.policy.server = self;
            client.on('session', function (accept, reject) {
                debug(client, 'requests a session');

                var session = accept();
                session.once('exec', function (accept, reject, info) {
                    debug(client, 'wants to execute: ' + inspect(info.command));
                    if (info.command.indexOf("fleetctl fd-forward") > -1 &&
                        info.command.indexOf("fleet.sock") > -1) {
                        debug(client, "routing execute to emulated fleetd");
                        var stream = accept();
                        client.policy.handleFleetStream(stream);
                    } else {
                        debug(client, "Unhandled command: " +
                            inspect(info.command));
                        reject();
                    }
                });
                session.on('subsystem', function (accept, reject, info) {
                    debug(client, 'invokes a subsystem');
                    reject();
                });
                session.on('auth-agent', function (accept, reject, info) {
                    debug(client, 'wants to forward agent');
                    accept();
                });
            });
        });
        client.on('tcpip', function (accept, reject, info) {
            debug(client, 'Client wants to forward TCP ' + inspect(info));
            // ... but we are going to disregard that and just forward to
            // ourselves, so that we can pretend we are the remote node.
            client.policy.handleTCPForward(client, accept());
        });
        client.on('openssh.streamlocal', function (accept, reject, info) {
            debug(client, 'Client wants to forward a stream');
            reject();
        });
        client.on('end', function () {
            debug(client, "disconnected");
        });
    });

    self.listen = server.listen.bind(server);
    self.address = server.address.bind(server);

    /**
     * Construct a policy object for a given public key
     *
     * The default implementation refuses everything, so you probably
     * want to override it.
     *
     * @param username The --ssh-username to fleetctl
     * @param publickey The public key as an SSH-style text string
     *                  (e.g. "ssh-rsa AAAAABBBBCCC= optional-id")
     * @returns Policy instance, or Policy promise, or undefined
     */
     self.findPolicy  = function (username, key) {};

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
     * @param channel The SSH channel to serve to
     */
    self.masqueradeSSH = function(policy, channel) {
        assert(policy);
        // TODO
        // Don't .listen() it; just steal its 'connection' handler
        // Create a fake connection and feed it to the above
        // call done(), wipe hands on pants
        var fakeInternalNode;
        fakeInternalNode = new ssh2.Server({
            privateKey: self.config.privateKey
        }, function (client) {
            debug(policy, 'set up fake internal node');
            client.auth = new Authenticator();
            client.auth.findPolicy = function () {
                return policy
            };
            client.auth.attach(client, fakeInternalNode);

            client.on('ready', function () {
                debug("Authenticated on the fake internal node");
                client.on('session', function (accept, reject) {
                    debug(client, 'requests a session on fake internal node');
                    var session = accept();
                    // Need to remember the pty details in between callbacks;
                    // see examples/server-chat.js in the ssh2 sources
                    var pty = {};
                    session.once("pty", function (accept, reject, info) {
                        pty.rows = info.rows;
                        pty.cols = info.cols;
                        pty.term = info.term;
                        accept && accept();
                        debug(client, "pty accepted, term=" + info.term);
                    });
                    session.once('shell', function (accept, reject, info) {
                        debug(client, 'wants a shell');
                        if (pty) {
                            policy.handleShell(pty, accept());
                        } else {
                            debug(client, "refusing to start shell without a pty");
                            reject();
                        }
                    });
                    session.once('exec', function (accept, reject, info) {
                        debug(client, 'wants to execute: ' + inspect(info.command));
                        if (pty) {
                            policy.handleExec(pty, accept(), info.command);
                        } else {
                            debug(client, "refusing to exec without a pty");
                            reject();
                        }
                    });
                });
            });
        });
        var ssh2socketHandler = fakeInternalNode._srv.listeners("connection")[0];
        ssh2socketHandler(channel);
    };
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
 * Take charge `client`'s "authentication" event.
 *
 * When authentication is complete, set client.policy to the applicable
 * Policy object, and set self.done to true.
 *
 * @param client The ssh2.Server's listener parameter
 */
Authenticator.prototype.attach = function(client) {
    var self = this;

    client.getDebugLabel = self.getDebugLabel.bind(self);

    // A one-slot cache for the policy object.
    // Mutation is forbidden once authentication is performed.
    var policyCache = {};
    policyCache.get = function(username, key) {
        var keyAsString = asPemKey(key).toString();
        if (policyCache.username) {
            if (policyCache.username === username &&
                policyCache.keyAsString === keyAsString) {
                // Cache read
                return policyCache.cached;
            } else if (self.done) {
                debug(self, "attempted to switch keys after authentication!");
                return;
            } else {
                debug(self, "changing identities from ("
                    + policyCache.username + ", " + policyCache.keyAsString
                    + ") to (" + username + ", " + keyAsString);
            }
        }
        // Cache write-through
        policyCache.username = username;
        policyCache.keyAsString = keyAsString;
        policyCache.cached = self.findPolicy(username, key);
        return policyCache.cached;
    };

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

        Q.when(policyCache.get(ctx.username, ctx.key))
            .then(function (policy) {
                if (! policy) {
                    debug(self, "presented unacceptable key");
                    ctx.reject();
                    return;
                }
                self.policyLabel = policy.getDebugLabel();
                debug("got policy! " + self.policyLabel);
                if (! ctx.signature) {
                    // If no signature is present, that means the client is just
                    // checking the validity of their public key
                    debug(self, "We will accept this public key");
                    ctx.accept();
                    return;
                }
                // Got crypto?
                var verifier = crypto.createVerify(ctx.sigAlgo);
                verifier.update(ctx.blob);
                if (verifier.verify(asPemKey(ctx.key),
                        ctx.signature, 'binary')) {
                    debug(self, "Public key authentication successful");
                    self.done = true;
                    /* Eject the policy towards client object */
                    client.policy = policy;
                    ctx.accept();
                } else {
                    debug(self, "Failed public key authentication");
                    ctx.reject();
                }
        });
    });
};

/**
 * For the debug() function
 */
Authenticator.prototype.getDebugLabel = function() {
    var label = this.policyLabel;
    if (! label) {
        return "Unauthenticated";
    } else if (! this.done) {
        return "?" + label + "?";
    } else {
        return label;
    }
};

/**
 * Overridable method: find a policy for a given public key
 *
 * @param username The --ssh-username to fleetctl
 * @param publickey The public key as an SSH-style text string
 *                  (e.g. "ssh-rsa AAAAABBBBCCC= optional-id")
 * @returns Policy instance, or Policy promise, or undefined
 */
Authenticator.prototype.findPolicy = undefined;

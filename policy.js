/**
 * Slightly more useful policy implementations than the one in sshd.js
 */

var assert = require("assert"),
    debug = require("debug")("policy.js"),
    util = require("util"),
    request = require("request"),
    Q = require("q");
    BasePolicy = require("./sshd").Policy;

/**
 * A policy that filters the commands w.r.t. a real fleetd.
 *
 * @param id Debugging moniker, passed on to sshd.Policy constructor
 * @param fleetdUnixSocketPath The server-side path to the fleetd's socket
 * @constructor
 */
var FilteringPolicy = exports.FilteringPolicy =
    function (id, fleetdUnixSocketPath) {
        var self = this;
        self.fleetdUnixSocketPath = fleetdUnixSocketPath;
        BasePolicy.call(self, id);
        self.fleetAPI.get("/fleet/v1/machines", function (req, res, next) {
            self.proxyToFleetd(req).then(function (proxyRes) {
                res.json(proxyRes.body);
            });
        });
        self.fleetAPI.get("/fleet/v1/units/:unit", function (req, res, next) {
            Q.when(self.isUnitAllowed(req.params.unit), function (isAllowed) {
                assert(isAllowed);  // TODO: respond properly on not allowed
                return self.proxyToFleetd(req);
            }).then(function (proxyRes) {
                res.json(proxyRes.body);
            }).catch(next);
        });
    };

util.inherits(FilteringPolicy, BasePolicy);

/**
 * Proxy a request to fleetd, unchanged.
 *
 * @param req The original request
 * @returns {Promise}
 */
FilteringPolicy.prototype.proxyToFleetd = function (req) {
    var proxyDone = Q.defer();
    request("http://unix:" + this.fleetdUnixSocketPath +
        ":" + req.path, function (err, proxyRes, body) {
        if (err) {
            proxyDone.reject(err);
        } else {
            debug("Response from fleetd: " + body);
            proxyRes.body = JSON.parse(body);
            proxyDone.resolve(proxyRes);
        }
    });
    return proxyDone.promise;
};

FilteringPolicy.prototype.isUnitAllowed = function (fleetUnitName) {
    return false;
};
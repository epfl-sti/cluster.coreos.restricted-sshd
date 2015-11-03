/**
 * Test keys
 */
var fs = require("fs"),
    path = require("path"),
    tmp = require("tmp"),
    Q = require("q"),
    keys = require("../keys");

var sampleRSAHostKey = {private: "-----BEGIN RSA PRIVATE KEY-----\n" +
"MIIEowIBAAKCAQEAyVSDd/okRNWe8BiKJJiYTwDh/eLtFF8JrOeBRYFQdLRcRiXV\n" +
"R3lh3wFs9Q7RoHS56iKKOV+nefFU1E4n9LU3znaowCXbZlYq2zuBlPTEKOXF+Xsi\n" +
"TuR11iPugKRwsPHbYtQZXFo8sutkPAt1aORxEoEYbKjN1BDLovD9AmQ+tGgMXMVd\n" +
"BUqwHZp0+QoesrxWU9uYNLhjvqF9jPMHyL0cOW1o6BUvLvoqjKhJV4pibGFaN03x\n" +
"vcGMGDHOtIIovukpO3Jqp1l3FML6ocpVoSOT++1YMAuh8Mt2BuVBZi/5Ie3/Ayrb\n" +
"LeR40tV3uY92HFfsPBEmuuQM8I83nqf2KbryYwIDAQABAoIBACXrvTeD7gDpG56t\n" +
"gJeUBlwbFnXzoCQOIoxmrnqg+L6Cmj68MYfc3QpcAmHGAMXwNnRbPR3BXpIhWpEC\n" +
"h5QX7gL9ZpuKheCoqjnQ439i+u+ZF8j94GBrt6Y17l5cmr05UNE0kfJLLNOmcqK8\n" +
"pciz/ng1yJvuz5X58+Ek8wLYTtc7zFFvxZlSb+qlFWs3s7t7mYs1pWO/aXCSKLNq\n" +
"cYh8/36Bt7DeP9yu7V7r9DvSqhibgfoKxZKs0nssfoe1cCVs9/W1pbfzx16E7RWm\n" +
"1wgAQ9iLhprOyL6pp7q7dLyKel6WpsV5KVvI6abSbk44cLRme2RTc05C6fGGr2k+\n" +
"j8Oq70ECgYEA5VGhaSeNf+rirv4voHlbDqkaU5mlS/pSoIesvBkewp7f0VgLAV1I\n" +
"DxvkWEe5EmfRv1R/9Ef0oM6blbXYMOSX1aeSjaLbhzqPuhBjjCIyZWDyFPna2LNm\n" +
"ldooBzVs877GBGgrQWQWTFur5Tied8CwAItcfV6klx0p1EgNx0Sl9icCgYEA4ME5\n" +
"tPaf9lsYqe9MqUt6ZORXvIe6uIjWYst49i5nmZKQcyyzuXR6poSlrjRXPtx11dXD\n" +
"4KUJCaYvp5HpBGcR1kJ2Rew86f9w5W37Lg/L8DTLKoaLoaPggyyB16PBDX6tGA1P\n" +
"7PkK8ztZlHspF/lJsBH0DAqoJURePATZtL0Ko2UCgYABCgqqOFSq1LysQFik6Ifi\n" +
"HCATaunV20+OjK7at15tUV0ATN7X5b1S3DR/tet/ytqnfFGMINtZ8zW/SvCs4AxU\n" +
"GotOewN1rG1EUZix5OHHldXjBHLaco2vdiqiRbq1rBKnqHUxuatkMzInOsd1EXl6\n" +
"tyb3Jnumd6pd3Om7EnOSFwKBgBdRFHqIp3m4Y6uljs91bCIxakS91Ao27/7Z2xe3\n" +
"IrpU8TVxqsePpPXHhyS2e2KjHnprreGNXY2ptwHsaj8xrjELPhfs9TjVblHvAgL6\n" +
"Uo79+yHTSYMgbDdPk7zaWTncLXr0TploENHBE38K8+1vyExC4I2rQVx0Zk5VtnxA\n" +
"rGzdAoGBAMwyxT/ObJpOBdPXOmilGp39RS5ZRwDSS9xX6kIqNvE3RmGcUwMPVCrx\n" +
"G4caJO8CBzrsXiLyNCBLDiFZmrjLJS5aj2Ep2974Duk2RWEnsAtR7xCEReN9Sdey\n" +
"94o6nP30gvf2xHXsdkIWqzgtz9NPCAoLEss7f8ZvNAbPNoqfyF5d\n" +
"-----END RSA PRIVATE KEY-----\n",
                    public: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDJVIN3+iRE1Z7wGIokmJhPAOH94u0UXwms54FFgVB0tFxGJdVHeWHfAWz1DtGgdLnqIoo5X6d58VTUTif0tTfOdqjAJdtmVirbO4GU9MQo5cX5eyJO5HXWI+6ApHCw8dti1BlcWjyy62Q8C3Vo5HESgRhsqM3UEMui8P0CZD60aAxcxV0FSrAdmnT5Ch6yvFZT25g0uGO+oX2M8wfIvRw5bWjoFS8u+iqMqElXimJsYVo3TfG9wYwYMc60gii+6Sk7cmqnWXcUwvqhylWhI5P77VgwC6Hwy3YG5UFmL/kh7f8DKtst5HjS1Xe5j3YcV+w8ESa65Azwjzeep/YpuvJj dom@vpn-253-006.epfl.ch"};

/**
 * Sample host key
 *
 * @constructor
 */
exports.HostKey = function() {
    this._private = sampleRSAHostKey.private;
    this._public = sampleRSAHostKey.public;
};

exports.HostKey.prototype.privateAsX509String = function() {
    return this._private;
};

exports.HostKey.prototype.publicAsSshString = function() {
    return this._public;
};

var sampleRSAUserKey = {
    private: "-----BEGIN RSA PRIVATE KEY-----\n" +
"MIIEpAIBAAKCAQEAy9gNvbja11EhCb82e2BoITg6GGLdEWjWOhHyukcN9Y/YhIiT\n" +
"1yKD0ZNJVx9BQ4Sb/CFmGMlzzFL633PLZTz5VWu2vOhYeE7Mo0bGmNL83AlVJoo8\n" +
"lrAHo137tq0QyotQygUZUIlWqjhokPq/DJuezBFT+VbOvcGsVGK77hxMA5wSLuWK\n" +
"pfcD2ccMMGmOmS7egnr7cpTwAwGKxwDRe5a9WHqxzWvnVJkNNe/55G26Zdijb3Rw\n" +
"13LGENxR68KCgdUeshfZaopAHlkO4cXTaZeJps9NymQz0Di0tZhGthJNAeYkGT2M\n" +
"QAaeeVH1fwMWB/s03250eSA83EOhThhzFXoCTQIDAQABAoIBAEZ7GaUzuVchkg7Q\n" +
"soHOP7LcwhmUdWODoC7L7eVClC0H45FPt+523KUmDAG3qNUzkMuIsMh5PzSyrFN+\n" +
"siD7CCrk53ZBz/UpKdB6tEg7C3r5Lxv4SCLCEqIF6PasuFWP/gsb4Djcg76valhW\n" +
"mqA9XpaolyRrQ2iRAoja6qfV2OKWAcAtJVZD1HU1LvoJl/Od1ywWbcOMkQuwNiEy\n" +
"nnjBXylwmNOV9RCGBJ76xp8Hes+0VOYgQkgzmSxy7OF8XrJG3L1R9fRuYLCPqQTE\n" +
"9bBFfWlqQx7F0S6UF71ikW+TXew7V21bd604gIAVA6+u1nXmEUoBlVcaQWxcCGps\n" +
"YnxSmgECgYEA9aM1YDiwKLYFMQl2KHTrH7B2xxE7J2yYkZvilZkoSBhwPetZ2Xl+\n" +
"Pn+aE3Hq9tbK1Cb2iRXWoOl3JWkhPvO+iCYFK2eRTwmlodBAJGnHneO2VfYBKZHR\n" +
"neZxNyk2JbBhooE2TYmNyAiuq0qcWYell6SZKM9UzfMRgqJJtjE8dO0CgYEA1HF9\n" +
"lM9qb04gb6eN7O3V/j65k003BqFU7weuTXhrBkcMR6PnNPZRvstPdxRPxODm/CD7\n" +
"nlzn6a8CMXn8DE2hSVxplnxkwHf6lQLnT5b7MZe4Ez+FbhA/4iV78MB1JjF2uine\n" +
"PwV2Mnwk5Y8otjYsDHx2IiBJapaeHVU3Bor6duECgYEAtMyyhuZy0yRW4eci71hP\n" +
"j/2lD5UhQz1tdw+UUaRvv9EtHIZUlfwU7g+h6toYpiMnG8yp/fDzD3GIXyLoc5uZ\n" +
"DEFf4LjUfaaOIXJVI/gwE4j+NntiE6Te8yghAQb2cftHggM1YxDyKOArIK1EM6ni\n" +
"OqHOkfk5ZHWa19p4AwBujWkCgYEAjHh2dx0m3W4lWG7ME2u34aMMBfA6gDHQ/TRw\n" +
"9ly3N7Fm1z/zMzvkFWpNowlVLXMgiHoupin8VrIXmytzk5cJHH70ekLKQ9GRaVJA\n" +
"LIpCkiol1uRbj8lC1H/AkhJP4+80+CeTAszTuNIJe5jLbKApRCBP5ITAxq/M4Mxl\n" +
"0/e1YUECgYBD9S5BNfyxSqfgEUo5hRf3vgiobAVwtsxdKLtfGLLVj1qDX6F98MLX\n" +
"qV83gRq7jwM4YMfhbNX8GWo6AIfjlvh8jFmW3MhFHRJhYY/fU26XF+CrhjLuxyeY\n" +
"AsncgfTdbjuCeaSUeZr+tDN6FEq8+8OIq9BOclMh+piBuOF3RytmOQ==\n" +
"-----END RSA PRIVATE KEY-----\n",
    public: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDL2A29uNrXUSEJvzZ7YGghODoYYt0RaNY6EfK6Rw31j9iEiJPXIoPRk0lXH0FDhJv8IWYYyXPMUvrfc8tlPPlVa7a86Fh4TsyjRsaY0vzcCVUmijyWsAejXfu2rRDKi1DKBRlQiVaqOGiQ+r8Mm57MEVP5Vs69waxUYrvuHEwDnBIu5Yql9wPZxwwwaY6ZLt6CevtylPADAYrHANF7lr1YerHNa+dUmQ017/nkbbpl2KNvdHDXcsYQ3FHrwoKB1R6yF9lqikAeWQ7hxdNpl4mmz03KZDPQOLS1mEa2Ek0B5iQZPYxABp55UfV/AxYH+zTfbnR5IDzcQ6FOGHMVegJN me@example.com"
};

/**
 * Sample user key
 *
 * @constructor
 */
exports.UserKey = function() {
    this._private = sampleRSAUserKey.private;
    this._public = sampleRSAUserKey.public;
};

exports.UserKey.prototype.privateAsX509String = function() {
    return this._private;
};

exports.UserKey.prototype.publicAsSshString = function() {
    return this._public;
};

exports.UserKey.prototype.promiseSave = function () {
    var paths = {};
    var self = this;
    return Q.nfcall(tmp.dir)
        .then(function (tmpDirAndCallback) {
            var tmpDir = tmpDirAndCallback[0];
            paths.dir = tmpDir;
            paths.private = path.join(paths.dir, "id_rsa");
            return Q.nfcall(fs.writeFile, paths.private, self._private);
        })
        .then(function () {
            return Q.nfcall(fs.chmod, paths.private, 0600)
        })
        .then(function () {
            paths.public = path.join(paths.dir, "id_rsa.pub");
            return Q.nfcall(fs.writeFile, paths.public, self._public);
        }).then(function () {
            return paths;
        });
};

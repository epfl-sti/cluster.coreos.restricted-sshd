# `cluster.coreos.restricted-sshd`

An ssh server in node.js that implements a multi-tenant policy for a
CoreOS cluster.

The
[`fleetctl` command](https://coreos.com/fleet/docs/latest/using-the-client.html)
is the native mechanism for submitting, controlling and deleting jobs
in a CoreOS cluster. The `fleetctl` client can
[run from a user's workstation or laptop](https://coreos.com/fleet/docs/latest/using-the-client.html#from-an-external-host),
and typically communicates over a bastion host (using the `--tunnel`
command line flag or `FLEETCTL_TUNNEL` environment variable).

`cluster.coreos.restricted-sshd` is compatible with all `fleetctl` commands, but
restricts access to jobs in a configurable way:
   + The job creation operations (`start` and `submit`) pre-process the service definition file using configurable code. 
   + The job inspection and destruction operations (all of them except `help` and `version`) check that the public key specified for ssh authentication has access to the target job(s), using a configurable piece of code for the check.
   + `fleetctl ssh` can only target a service, and forwards to a `root` shell inside the Docker container of the same name (as opposed to a “top-level” `core` shell).

`cluster.coreos.restricted-sshd` is *not* a general-purpose SSH
server. It doesn't forward agents. It may in the future obey the -D
flag (SOCKS) to provide proxy-as-a-service to tenants, but again, it
will only do so in a way that doesn't break the access control policy
(e.g. it will only be possible to run the SOCKS server from a Docker
container that the tenant has access to through `fleetctl ssh`).

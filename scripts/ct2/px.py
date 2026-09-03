#!/usr/bin/env python3
"""psql demotado contra o cluster descartavel CT-2."""
import os, subprocess, sys

BASE = "/tmp/ct2_dryrun"
UID = GID = 65534


def demote():
    os.setgid(GID); os.setuid(UID)


env = dict(os.environ, PGHOST=os.path.join(BASE, "sock"), PGUSER="postgres",
           PGDATABASE="postgres")
args = ["psql", "-v", "ON_ERROR_STOP=1", "-X"] + sys.argv[1:]
for a in sys.argv[1:]:
    if os.path.isfile(a):
        os.chmod(a, 0o644)
r = subprocess.run(args, preexec_fn=demote, env=env, capture_output=True, text=True)
sys.stdout.write(r.stdout)
sys.stderr.write(r.stderr)
sys.exit(r.returncode)

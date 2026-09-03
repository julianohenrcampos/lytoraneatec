#!/usr/bin/env python3
"""CT-2 — orquestrador do dry-run sequencial em PostgreSQL 17 descartavel.

NAO toca no banco vivo. Sobe um cluster temporario, aplica a fixture,
a M2 R4 ja aplicada em producao, e entao M2.1 + M3 R3 dentro de uma
transacao descartavel, terminando em ROLLBACK.
"""
import os, pwd, subprocess, sys, shutil, tempfile, time

BASE = "/tmp/ct2_dryrun"
UID = 65534  # nobody
GID = 65534


def demote():
    os.setgid(GID)
    os.setuid(UID)


def run(cmd, **kw):
    r = subprocess.run(cmd, preexec_fn=demote, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print("STDERR:", r.stderr[-2000:]); sys.exit(1)
    return r
    return subprocess.run(cmd, preexec_fn=demote, check=True,
                          capture_output=True, text=True, **kw)


def main():
    shutil.rmtree(BASE, ignore_errors=True)
    data = os.path.join(BASE, "data")
    sock = os.path.join(BASE, "sock")
    os.makedirs(data); os.makedirs(sock)
    for p in (BASE, data, sock):
        os.chown(p, UID, GID)
    # scripts precisam ser legiveis pelo uid rebaixado
    for f in sys.argv[1:]:
        os.chmod(f, 0o644)

    print(run(["initdb", "-D", data, "-U", "postgres", "--no-locale",
               "-E", "UTF8"]).stdout[-500:])
    run(["pg_ctl", "-D", data, "-o", f"-k {sock} -c listen_addresses=", "-w",
         "-l", os.path.join(BASE, "pg.log"), "start"])
    print("cluster iniciado")
    env = dict(os.environ, PGHOST=sock, PGUSER="postgres", PGDATABASE="postgres")
    v = subprocess.run(["psql", "-Atc", "select version()"], preexec_fn=demote,
                       env=env, capture_output=True, text=True)
    print(v.stdout.strip())
    return BASE, sock, env


if __name__ == "__main__":
    base, sock, env = main()
    print(f"OK socket={sock}")

#!/usr/bin/env bash
# CT-2 — runner do dry-run sequencial em PG17 descartavel.
# NAO toca no banco vivo.
set -euo pipefail
cd /dev-server
BASE=/tmp/ct2_dryrun

python3 scripts/ct2/dryrun_boot.py
mkdir -p "$BASE"

# versoes sem controle de transacao (a transacao e do dry-run)
grep -vE '^(BEGIN|COMMIT);\s*$' docs/ct2/20260728200000_ct2_m2a_permission_guards.sql > "$BASE/m2a_notx.sql"
grep -vE '^(BEGIN|COMMIT);\s*$' docs/ct2/20260728202000_ct2_m3r3_central_transporte_rbac.sql > "$BASE/m3r3_notx.sql"
chmod 644 "$BASE"/*.sql

echo "=== BASELINE: fixture (M1/M1.1 + helpers + catalogo RBAC) ==="
python3 scripts/ct2/px.py -f scripts/ct2/dryrun_fixture.sql > "$BASE/out_fixture.log" 2>&1 || { tail -40 "$BASE/out_fixture.log"; exit 1; }
echo "=== BASELINE: M2 R4 (migration real aplicada em producao) ==="
python3 scripts/ct2/px.py -f supabase/migrations/20260728185523_6bc1e6c1-a6cc-4bcf-bd95-d24abcbe3ca0.sql > "$BASE/out_m2r4.log" 2>&1 || { tail -40 "$BASE/out_m2r4.log"; exit 1; }

echo "=== DRY-RUN SEQUENCIAL ==="
python3 scripts/ct2/px.py -f scripts/ct2/dryrun_sequencial.sql 2>&1 | tee "$BASE/out_dryrun.log"

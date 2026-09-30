#!/usr/bin/env bash
# perf-lh (step 21 audit): runs the project's Lighthouse runner (tests/lighthouse/run.mjs) one run at a
# time against the isolated server :3200. cwd is .lighthouse/perf-lh-audit so the JSON reports land in
# .lighthouse/perf-lh-audit/.lighthouse/ and never collide with other tracks.
set -u
ROOT="/c/Users/admin/Desktop/Web Dev Projects/autodelovi"
RUN="C:/Users/admin/Desktop/Web Dev Projects/autodelovi/tests/lighthouse/run.mjs"
LOG="$ROOT/docs/qa/audit/perf-lh/lh-console.log"
cd "$ROOT/.lighthouse/perf-lh-audit"
export MSYS_NO_PATHCONV=1
B=http://localhost:3200
r() { echo "=== $(date +%T) $*" >> "$LOG"; node "$RUN" --base $B "$@" >> "$LOG" 2>&1; echo "=== exit $? $(date +%T)" >> "$LOG"; }
KEY="/delovi/kocioni-diskovi /deo/kocioni-disk-prednji-276-24-mm-demo-0004"
OTHERS="/delovi /pretraga?q=disk /vozila/volkswagen/golf/golf-7 /delovi/kocioni-diskovi/volkswagen/golf /za-majstore /upit /ponuda/kocione-plocice-golf /kontakt"
# mobile, applied throttling (budget method D112)
r --runs 5 --throttling devtools /
r --runs 3 --throttling devtools $KEY
# mobile, simulated (Lantern)
r --runs 3 --throttling simulate / $KEY
# others, mobile x1 each method
r --runs 1 --throttling devtools $OTHERS
r --runs 1 --throttling simulate $OTHERS
# desktop preset
r --runs 3 --desktop / $KEY
r --runs 1 --desktop $OTHERS
echo "=== ALL DONE $(date +%T)" >> "$LOG"

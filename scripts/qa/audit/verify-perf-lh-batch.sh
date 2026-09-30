#!/usr/bin/env bash
# verify perf-lh: sequential Lighthouse batch against :3200 (independent verifier).
set -u
cd "/c/Users/admin/Desktop/Web Dev Projects/autodelovi"
export MSYS_NO_PATHCONV=1
LOG=docs/qa/audit/verify/perf-lh/lh-console.log
R="node scripts/qa/audit/verify-perf-lh-runner.mjs --base http://localhost:3200"
echo "=== start $(date +%T)" >> $LOG
$R --runs 3 --throttling devtools --tag v1 --paths "/,/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004" >> $LOG 2>&1
$R --runs 3 --throttling devtools --tag v1 --paths "/vozila/volkswagen/golf/golf-7,/upit,/delovi/kocioni-diskovi/volkswagen/golf,/ponuda/kocione-plocice-golf" >> $LOG 2>&1
$R --runs 3 --throttling simulate --tag v1 --paths "/,/deo/kocioni-disk-prednji-276-24-mm-demo-0004" >> $LOG 2>&1
$R --runs 2 --throttling simulate --desktop --tag v1 --paths "/vozila/volkswagen/golf/golf-7" >> $LOG 2>&1
echo "=== ALL DONE $(date +%T)" >> $LOG

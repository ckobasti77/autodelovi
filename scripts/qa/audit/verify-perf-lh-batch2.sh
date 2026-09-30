#!/usr/bin/env bash
# verify perf-lh: Playwright checks (perf-lh-02/03/06/07) then 3D checks (perf-3d-*), sequential,
# after the Lighthouse batch has finished. Logs to docs/qa/audit/verify/perf-lh/.
set -u
cd "/c/Users/admin/Desktop/Web Dev Projects/autodelovi"
D=docs/qa/audit/verify/perf-lh
until grep -q "ALL DONE" $D/lh-console.log; do sleep 5; done
export AUDIT_BASE=http://localhost:3200
echo "=== pw start $(date +%T)" >> $D/pw-console.log
THROTTLE=1 node scripts/qa/audit/verify-perf-lh-cls-mono.mjs >> $D/pw-console.log 2>&1
node scripts/qa/audit/verify-perf-lh-02-fonts.mjs 3 >> $D/pw-console.log 2>&1
PATHS=/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004 node scripts/qa/audit/verify-perf-lh-trace.mjs 2 > $D/perf-lh-06-trace-motion.txt 2>&1
RM=reduce PATHS=/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004 node scripts/qa/audit/verify-perf-lh-trace.mjs 2 > $D/perf-lh-06-trace-reduce.txt 2>&1
node scripts/qa/audit/verify-perf-lh-failsafe.mjs 2 > $D/perf-lh-07-failsafe.txt 2>&1
echo "=== pw done $(date +%T)" >> $D/pw-console.log
mkdir -p $D/3d
node scripts/qa/audit/verify-perf-3d-frames.mjs --vp mobile --cpu 4 --gpu --runs 3 --tag verify-mobile-cpu4-gpu > $D/3d/frames-mobile-cpu4-gpu.txt 2>&1
node scripts/qa/audit/verify-perf-3d-frames.mjs --vp desktop --cpu 4 --gpu --runs 3 --tag verify-desktop-cpu4-gpu > $D/3d/frames-desktop-cpu4-gpu.txt 2>&1
for i in 1 2; do node scripts/qa/hero-frames.mjs --base http://localhost:3200 --cpu 4 --gpu >> $D/3d/hero-frames-cpu4-gpu.txt 2>&1; done
node scripts/qa/audit/verify-perf-3d-interact.mjs --vp mobile --cpu 4 --gpu --runs 3 > $D/3d/interact-mobile.txt 2>&1
node scripts/qa/audit/verify-perf-3d-profile.mjs --vp desktop --cpu 1 --gpu --runs 2 > $D/3d/profile-start-desktop-cpu1.txt 2>&1
node scripts/qa/audit/verify-perf-3d-leak.mjs --gpu --cycles 3 > $D/3d/leak-desktop-gpu.txt 2>&1
node scripts/qa/audit/verify-perf-3d-frames.mjs --vp desktop --cpu 1 --runs 1 --tag verify-desktop-cpu1-swiftshader > $D/3d/frames-desktop-cpu1-swiftshader.txt 2>&1
echo "=== ALL DONE 2 $(date +%T)" >> $D/pw-console.log

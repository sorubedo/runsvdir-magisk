#!/system/bin/sh
# post-fs-data.sh: Runs BEFORE late_start service
# Ensure persistent data directories exist

mkdir -p /data/adb/runsvdir/service
mkdir -p /data/adb/runsvdir/log/sv
mkdir -p /data/adb/runsvdir/run

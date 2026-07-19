#!/system/bin/sh
# service.sh: Runs in late_start service mode (non-blocking)
# Starts the runsvdir supervisor

MODDIR=${0%/*}

# Wait for system boot to complete
while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 2
done

# Start runsvdir
"$MODDIR/system/bin/runsvdir-magisk" start

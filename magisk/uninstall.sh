#!/system/bin/sh
# uninstall.sh: Cleanup when module is removed

MODDIR=${0%/*}

# Stop runsvdir gracefully
if [ -x "$MODDIR/system/bin/runsvdir-magisk" ]; then
    "$MODDIR/system/bin/runsvdir-magisk" stop 2>/dev/null
fi

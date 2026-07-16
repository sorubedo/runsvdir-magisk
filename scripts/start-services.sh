# Source this file in your shell profile to auto-start runsvdir
# Example: add to ~/.profile or /etc/profile.d/

export SVDIR=/data/adb/runsvdir/service
export LOGDIR=/data/adb/runsvdir/log

# Start runsvdir in background (will be a no-op if already running)
(runsvdir-magisk start >/dev/null 2>&1 &)

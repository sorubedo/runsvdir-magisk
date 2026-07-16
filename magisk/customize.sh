#!/system/bin/sh

# Map Magisk ARCH to our ABI directory name
case "$ARCH" in
    arm64)   ABI=arm64-v8a ;;
    arm)     ABI=armeabi-v7a ;;
    x64)     ABI=x86_64 ;;
    x86)     ABI=x86 ;;
    riscv64) ABI=riscv64 ;;
    *)
        ui_print "! Unsupported architecture: $ARCH"
        abort "! Aborting installation"
        ;;
esac

ui_print "- Installing runsvdir binaries for $ARCH ($ABI)"

# Copy binaries
mkdir -p "$MODPATH/system/bin"
cp "$MODPATH/bin/$ABI/runsvdir"   "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/runsv"      "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/sv"         "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/svlogd"     "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/chpst"      "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/runsvchdir" "$MODPATH/system/bin/"

# Copy wrapper scripts
cp "$MODPATH/scripts/"* "$MODPATH/system/bin/" 2>/dev/null || true

# Install shell profile to auto-export SVDIR
mkdir -p "$MODPATH/system/etc/profile.d"
cat > "$MODPATH/system/etc/profile.d/runsvdir.sh" << 'PROFILE'
export SVDIR=/data/adb/runsvdir/service
export LOGDIR=/data/adb/runsvdir/log
PROFILE

# Set permissions
set_perm_recursive "$MODPATH/system/bin"  0 0 0755 0755
set_perm_recursive "$MODPATH/system/etc"  0 0 0755 0644

# Clean up install-only files
rm -rf "$MODPATH/bin" "$MODPATH/scripts"

FINAL_PATH=/data/adb/runsvdir
ui_print ""
ui_print "- Runsvdir installed! (will activate on next reboot)"
ui_print "- After reboot, services live at:"
ui_print "  $FINAL_PATH/service/"
ui_print ""
ui_print "- Quick start after reboot:"
ui_print "  sv-enable <service>      (enable + auto-start)"
ui_print "  runsvdir-magisk restart  (restart supervisor)"

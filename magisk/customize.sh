#!/system/bin/sh

# Map Magisk ARCH to Termux ABI directory name
case "$ARCH" in
    arm64) ABI=aarch64; LIBDIR=lib64 ;;
    arm)   ABI=arm;    LIBDIR=lib ;;
    x64)   ABI=x86_64; LIBDIR=lib64 ;;
    x86)   ABI=i686;   LIBDIR=lib ;;
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
cp "$MODPATH/bin/$ABI/svlogd"     "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/chpst"      "$MODPATH/system/bin/"
cp "$MODPATH/bin/$ABI/runsvchdir" "$MODPATH/system/bin/"

# Place real sv in .runit/ (basename stays "sv" to avoid LSB mode)
mkdir -p "$MODPATH/system/bin/.runit"
cp "$MODPATH/bin/$ABI/sv" "$MODPATH/system/bin/.runit/sv"

# Place librunit.so in standard system lib path (linker finds it automatically)
mkdir -p "$MODPATH/system/$LIBDIR"
cp "$MODPATH/bin/$ABI/librunit.so" "$MODPATH/system/$LIBDIR/"

# Set permissions
set_perm_recursive "$MODPATH/system/bin"  0 0 0755 0755

# Clean up install-only files
rm -rf "$MODPATH/bin"

FINAL_PATH=/data/adb/runsvdir
ui_print ""
ui_print "- Runsvdir installed! (will activate on next reboot)"
ui_print "- After reboot, services live at:"
ui_print "  $FINAL_PATH/service/"
ui_print ""
ui_print "- Quick start after reboot:"
ui_print "  sv-enable <service>      (enable + auto-start)"
ui_print "  runsvdir-magisk restart  (restart supervisor)"

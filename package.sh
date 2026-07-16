#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${1:-v1.1.0}"
ZIPNAME="runsvdir-magisk-${VERSION}.zip"
BUILD_DIR="$PROJECT_DIR/build"
PKGDIR="/tmp/runsvdir-pkg"
ABIS=("arm64-v8a" "armeabi-v7a" "x86_64" "x86")
STRIP="/opt/android-ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip"
CMDLINE="-DCMAKE_TOOLCHAIN_FILE=/opt/android-ndk/build/cmake/android.toolchain.cmake -DANDROID_PLATFORM=android-24 -DCMAKE_BUILD_TYPE=Release"

echo "=== Step 0: Build WebUI ==="
if [ -f "$PROJECT_DIR/package.json" ]; then
    (cd "$PROJECT_DIR" && npm run build)
    echo "   ok: webui"
else
    echo "   skip: no package.json"
fi

echo ""
echo "=== Step 1: Clean and build ==="
rm -rf "$BUILD_DIR"
for ABI in "${ABIS[@]}"; do
    echo "   Building $ABI..."
    cmake -B "$BUILD_DIR/$ABI" -G Ninja $CMDLINE -DANDROID_ABI="$ABI" >/dev/null 2>&1
    ninja -C "$BUILD_DIR/$ABI" -j$(nproc) >/dev/null 2>&1
    echo "   ok: $ABI"
done

echo ""
echo "=== Step 2: Strip ==="
for ABI in "${ABIS[@]}"; do
    for bin in runsvdir runsv sv svlogd chpst runsvchdir; do
        "$STRIP" --strip-all "$BUILD_DIR/$ABI/src/$bin" 2>/dev/null
    done
    printf "   %-14s %7d bytes (runsvdir)\n" "$ABI:" $(wc -c < "$BUILD_DIR/$ABI/src/runsvdir")
done

echo ""
echo "=== Step 3: Assemble package ==="
rm -rf "$PKGDIR"
mkdir -p "$PKGDIR/META-INF/com/google/android"

# Binaries
for ABI in "${ABIS[@]}"; do
    mkdir -p "$PKGDIR/bin/$ABI"
    for bin in runsvdir runsv sv svlogd chpst runsvchdir; do
        cp "$BUILD_DIR/$ABI/src/$bin" "$PKGDIR/bin/$ABI/"
    done
done

# Magisk module metadata
cp "$PROJECT_DIR/magisk/module.prop"       "$PKGDIR/"
VCODE=$(echo "$VERSION" | sed 's/^v//; s/\.//g')
sed -i "s/^version=.*/version=${VERSION}/"  "$PKGDIR/module.prop"
sed -i "s/^versionCode=.*/versionCode=${VCODE}/" "$PKGDIR/module.prop"
cp "$PROJECT_DIR/magisk/customize.sh"      "$PKGDIR/"
cp "$PROJECT_DIR/magisk/post-fs-data.sh"   "$PKGDIR/"
cp "$PROJECT_DIR/magisk/service.sh"        "$PKGDIR/"
cp "$PROJECT_DIR/magisk/uninstall.sh"      "$PKGDIR/"
cp "$PROJECT_DIR/magisk/sepolicy.rule"     "$PKGDIR/"

# Wrapper scripts
mkdir -p "$PKGDIR/scripts"
cp "$PROJECT_DIR/scripts/"* "$PKGDIR/scripts/"
chmod 755 "$PKGDIR/scripts/"*

# WebUI (KernelSU/MMRL)
if [ -d "$PROJECT_DIR/magisk/webroot" ]; then
    mkdir -p "$PKGDIR/webroot"
    cp -r "$PROJECT_DIR/magisk/webroot/"* "$PKGDIR/webroot/"
fi

# Recovery flash support
cat > "$PKGDIR/META-INF/com/google/android/update-binary" << 'UPDBIN'
#!/sbin/sh
umask 022
OUTFD=$2
ZIPFILE=$3
ui_print() { echo "$1"; }
abort() { ui_print "$1"; exit 1; }
mount /data 2>/dev/null
if [ -f /data/adb/magisk/util_functions.sh ]; then
  . /data/adb/magisk/util_functions.sh
  [ $MAGISK_VER_CODE -gt 20400 ] || abort "! Magisk v20.4+ required"
  install_module
  exit 0
fi
ui_print "- runsvdir-magisk $VERSION"
ui_print "- Manual install..."
MODPATH=/data/adb/modules/runsvdir
rm -rf "$MODPATH"
mkdir -p "$MODPATH"
unzip -o "$ZIPFILE" -d "$MODPATH" >/dev/null 2>&1
cd "$MODPATH"
. ./customize.sh
rm -rf "$MODPATH/bin" "$MODPATH/scripts" "$MODPATH/META-INF"
ui_print "- Done. Reboot to start."
UPDBIN
echo '#MAGISK' > "$PKGDIR/META-INF/com/google/android/updater-script"
chmod 755 "$PKGDIR/META-INF/com/google/android/update-binary"

echo ""
echo "=== Step 4: Create zip ==="
rm -f "$PROJECT_DIR/$ZIPNAME"
cd "$PKGDIR"
zip -r "$PROJECT_DIR/$ZIPNAME" . >/dev/null 2>&1

echo ""
echo "=== Done: $ZIPNAME ($(du -h "$PROJECT_DIR/$ZIPNAME" | cut -f1)) ==="
ls -lh "$PROJECT_DIR/$ZIPNAME"

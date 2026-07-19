#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(sed -n 's/^version=//p' "$PROJECT_DIR/magisk/module.prop")"
ZIPNAME="runsvdir-magisk-${VERSION}.zip"
PKGDIR="/tmp/runsvdir-pkg"
ABIS=("aarch64" "arm" "i686" "x86_64")

echo "=== Step 0: Build WebUI ==="
if [ -f "$PROJECT_DIR/package.json" ]; then
    (cd "$PROJECT_DIR" && npm run build)
    echo "   ok: webui"
else
    echo "   skip: no package.json"
fi

echo ""
echo "=== Step 1: Download Termux runit binaries ==="
bash "$PROJECT_DIR/dl-bins.sh"

echo ""
echo "=== Step 2: Verify binaries ==="
for ABI in "${ABIS[@]}"; do
    if [ ! -f "$PROJECT_DIR/bin/$ABI/runsvdir" ]; then
        echo "ERROR: runsvdir binary missing for $ABI"
        echo "Run dl-bins.sh to download Termux runit binaries."
        exit 1
    fi
    printf "   %-9s %s\n" "$ABI:" "$(file "$PROJECT_DIR/bin/$ABI/runsvdir" | sed 's/.*ELF/ELF/')"
done

echo ""
echo "=== Step 3: Assemble package ==="
rm -rf "$PKGDIR"
mkdir -p "$PKGDIR"

# Per-ABI binaries (not in magisk/, at repo root)
for ABI in "${ABIS[@]}"; do
    mkdir -p "$PKGDIR/bin/$ABI"
    cp "$PROJECT_DIR/bin/$ABI/"* "$PKGDIR/bin/$ABI/"
done

# Everything else from magisk/ goes to ZIP root
cp -r "$PROJECT_DIR/magisk/"* "$PKGDIR/"
chmod 755 "$PKGDIR/META-INF/com/google/android/update-binary"

echo ""
echo "=== Step 4: Create zip ==="
rm -f "$PROJECT_DIR/$ZIPNAME"
cd "$PKGDIR"
zip -r "$PROJECT_DIR/$ZIPNAME" . >/dev/null 2>&1

echo ""
echo "=== Done: $ZIPNAME ($(du -h "$PROJECT_DIR/$ZIPNAME" | cut -f1)) ==="
ls -lh "$PROJECT_DIR/$ZIPNAME"

#!/bin/bash
set -e

if ! command -v patchelf &> /dev/null; then
    echo "ERROR: patchelf is required. Install with: apt install patchelf"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINS_DIR="$PROJECT_DIR/bin"
OUT_DIR="$PROJECT_DIR/out"
REPO_BASE="https://packages.termux.dev/apt/termux-main"
POOL="pool/main/r/runit"
RUNIT_VERSION="2.1.2"
TERMUX_PACKAGE_VERSION="${RUNIT_VERSION}-4"

declare -A ARCH_MAP=(
    ["aarch64"]="runit_${TERMUX_PACKAGE_VERSION}_aarch64.deb"
    ["arm"]="runit_${TERMUX_PACKAGE_VERSION}_arm.deb"
    ["i686"]="runit_${TERMUX_PACKAGE_VERSION}_i686.deb"
    ["x86_64"]="runit_${TERMUX_PACKAGE_VERSION}_x86_64.deb"
)

BINARIES=("runsvdir" "runsv" "sv" "svlogd" "chpst" "runsvchdir")

TMPDIRS=()
cleanup() {
    for d in "${TMPDIRS[@]}"; do
        rm -rf "$d"
    done
}
trap cleanup EXIT

for ARCH in "${!ARCH_MAP[@]}"; do
    DEB="${ARCH_MAP[$ARCH]}"
    URL="$REPO_BASE/$POOL/$DEB"
    DEST="$BINS_DIR/$ARCH"

    if [ -f "$DEST/runsvdir" ]; then
        echo "=== $ARCH: already exists, skipping ==="
        continue
    fi

    echo "=== $ARCH: downloading $DEB ==="
    TMPDIR="$(mktemp -d)"
    TMPDIRS+=("$TMPDIR")

    curl -fsSL "$URL" -o "$TMPDIR/$DEB"

    echo "=== $ARCH: extracting ==="
    (cd "$TMPDIR" && ar x "$DEB" data.tar.xz)
    mkdir -p "$DEST"
    tar -xJf "$TMPDIR/data.tar.xz" -C "$TMPDIR"

    for bin in "${BINARIES[@]}"; do
        src="$(find "$TMPDIR/data/data/com.termux/files/usr/bin" -name "$bin" -type f 2>/dev/null || true)"
        if [ -z "$src" ]; then
            echo "ERROR: $bin not found in $DEB"
            exit 1
        fi
        cp "$src" "$DEST/"
        echo "  $bin ($(wc -c < "$DEST/$bin") bytes)"
    done

    # librunit.so (shared library required by all binaries)
    lib_src="$(find "$TMPDIR/data/data/com.termux/files/usr/lib" -name "librunit.so" -type f 2>/dev/null || true)"
    if [ -z "$lib_src" ]; then
        echo "ERROR: librunit.so not found in $DEB"
        exit 1
    fi
    cp "$lib_src" "$DEST/"
    echo "  librunit.so ($(wc -c < "$DEST/librunit.so") bytes)"

    # Strip Termux RUNPATH from all binaries (security: points to app-private dir)
    echo "  removing RUNPATH..."
    for bin in "${BINARIES[@]}"; do
        patchelf --remove-rpath "$DEST/$bin"
    done
    patchelf --remove-rpath "$DEST/librunit.so"

    rm -rf "$TMPDIR"
    echo "=== $ARCH: done ==="
done

echo ""
echo "=== All binaries downloaded ==="
for ARCH in "${!ARCH_MAP[@]}"; do
    if [ -f "$BINS_DIR/$ARCH/runsvdir" ]; then
        printf "  %-9s %s\n" "$ARCH:" "$(file "$BINS_DIR/$ARCH/runsvdir")"
    else
        echo "  $ARCH: MISSING"
    fi
done

mkdir -p "$OUT_DIR"
{
    printf 'runit_version=%s\n' "$RUNIT_VERSION"
    printf 'termux_package_version=%s\n' "$TERMUX_PACKAGE_VERSION"
} > "$OUT_DIR/upstream-versions.env"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'runit_version=%s\n' "$RUNIT_VERSION" >> "$GITHUB_OUTPUT"
    printf 'termux_package_version=%s\n' "$TERMUX_PACKAGE_VERSION" >> "$GITHUB_OUTPUT"
fi

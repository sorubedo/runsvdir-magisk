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
POOL_URL="$REPO_BASE/$POOL"

BINARIES=("runsvdir" "runsv" "sv" "svlogd" "chpst" "runsvchdir")
ARCHES=("aarch64" "arm" "i686" "x86_64")

TMPDIRS=()
cleanup() {
    for d in "${TMPDIRS[@]}"; do
        rm -rf "$d"
    done
}
trap cleanup EXIT

# --- Resolve the newest runit .deb available for each architecture ---
# Rather than pinning a version (which breaks whenever Termux drops the old
# package from its pool), scrape the pool index and pick the latest per arch.
echo "=== Resolving latest runit package from $POOL_URL ==="
INDEX_HTML="$(curl -fsSL "$POOL_URL/")"

declare -A DEB_FILE=()
for ARCH in "${ARCHES[@]}"; do
    LATEST="$(printf '%s\n' "$INDEX_HTML" \
        | grep -oE "runit_[^\"'<>/]+_${ARCH}\.deb" \
        | sort -uV \
        | tail -n1)"
    if [ -z "$LATEST" ]; then
        echo "ERROR: no runit package found for $ARCH in $POOL_URL" >&2
        exit 1
    fi
    DEB_FILE["$ARCH"]="$LATEST"
    echo "  $ARCH: $LATEST"
done

# Derive the package and upstream versions from the resolved filenames.
VERSIONS=()
for ARCH in "${ARCHES[@]}"; do
    VER="${DEB_FILE[$ARCH]#runit_}"
    VER="${VER%_${ARCH}.deb}"
    VERSIONS+=("$VER")
done
TERMUX_PACKAGE_VERSION="$(printf '%s\n' "${VERSIONS[@]}" | sort -V | tail -n1)"
RUNIT_VERSION="${TERMUX_PACKAGE_VERSION%%-*}"
echo "  package version: $TERMUX_PACKAGE_VERSION"
echo "  upstream runit:  $RUNIT_VERSION"
echo

for ARCH in "${ARCHES[@]}"; do
    DEB="${DEB_FILE[$ARCH]}"
    URL="$POOL_URL/$DEB"
    DEST="$BINS_DIR/$ARCH"
    STAMP="$DEST/.termux-package-version"

    if [ -f "$DEST/runsvdir" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$TERMUX_PACKAGE_VERSION" ]; then
        echo "=== $ARCH: $TERMUX_PACKAGE_VERSION already present, skipping ==="
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

    printf '%s\n' "$TERMUX_PACKAGE_VERSION" > "$STAMP"

    rm -rf "$TMPDIR"
    echo "=== $ARCH: done ==="
done

echo ""
echo "=== All binaries downloaded ==="
for ARCH in "${ARCHES[@]}"; do
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

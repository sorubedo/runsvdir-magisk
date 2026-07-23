#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="runsvdir-magisk"
VERSION="$(sed -n 's/^version=//p' "$PROJECT_DIR/magisk/module.prop")"
OUT_DIR="$PROJECT_DIR/out"
SUPPORTED_ABIS=(arm64-v8a armeabi-v7a x86_64 x86)
BINARIES=(runsvdir runsv sv svlogd chpst runsvchdir librunit.so)

declare -A BIN_ABI=(
    [arm64-v8a]=aarch64
    [armeabi-v7a]=arm
    [x86_64]=x86_64
    [x86]=i686
)

usage() {
    echo "Usage: $0 [arm64-v8a|armeabi-v7a|x86_64|x86 ...]"
    echo "With no ABI arguments, packages all supported ABIs separately."
    echo "Run npm run build and dl-bins.sh before packaging."
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    usage
    exit 0
fi

if [ "$#" -gt 0 ]; then
    ABIS=("$@")
else
    ABIS=("${SUPPORTED_ABIS[@]}")
fi

for ABI in "${ABIS[@]}"; do
    if [ -z "${BIN_ABI[$ABI]:-}" ]; then
        echo "ERROR: unsupported ABI: $ABI" >&2
        usage >&2
        exit 1
    fi
done

mkdir -p "$OUT_DIR"
PACKAGES=()

for ABI in "${ABIS[@]}"; do
    SOURCE_ABI="${BIN_ABI[$ABI]}"
    for binary in "${BINARIES[@]}"; do
        if [ ! -f "$PROJECT_DIR/bin/$SOURCE_ABI/$binary" ]; then
            echo "ERROR: missing bin/$SOURCE_ABI/$binary; run dl-bins.sh first" >&2
            exit 1
        fi
    done

    STAGE_DIR="$(mktemp -d)"
    trap 'rm -rf "$STAGE_DIR"' EXIT

    cp -a "$PROJECT_DIR/magisk/." "$STAGE_DIR/"
    mkdir -p "$STAGE_DIR/bin/$SOURCE_ABI"
    for binary in "${BINARIES[@]}"; do
        cp -a "$PROJECT_DIR/bin/$SOURCE_ABI/$binary" "$STAGE_DIR/bin/$SOURCE_ABI/"
    done
    chmod 755 "$STAGE_DIR/META-INF/com/google/android/update-binary"

    {
        echo "moduleVersion=$VERSION"
        echo "targetAbi=$ABI"
        [ ! -f "$OUT_DIR/upstream-versions.env" ] || cat "$OUT_DIR/upstream-versions.env"
    } > "$STAGE_DIR/build-info.prop"

    ZIP_NAME="${NAME}-${VERSION}-${ABI}.zip"
    ZIP_PATH="$OUT_DIR/$ZIP_NAME"
    rm -f "$ZIP_PATH"
    (cd "$STAGE_DIR" && zip -qr "$ZIP_PATH" .)
    PACKAGES+=("$ZIP_NAME")

    rm -rf "$STAGE_DIR"
    trap - EXIT
    echo "=> out/$ZIP_NAME ($(du -h "$ZIP_PATH" | cut -f1))"
done

(cd "$OUT_DIR" && sha256sum "${PACKAGES[@]}" > SHA256SUMS)
echo "=> out/SHA256SUMS"

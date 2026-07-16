#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
ABIS=("arm64-v8a" "armeabi-v7a" "x86_64" "x86")

# LLVM strip tool (same for all ABIs)
STRIP="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip"
if [ ! -x "$STRIP" ]; then
    STRIP="/opt/android-ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip"
fi

for ABI in "${ABIS[@]}"; do
    echo "=== Building for $ABI ==="

    cmake -B "$BUILD_DIR/$ABI" -G Ninja \
        -DCMAKE_TOOLCHAIN_FILE="/opt/android-ndk/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="$ABI" \
        -DANDROID_PLATFORM=android-24 \
        -DCMAKE_BUILD_TYPE=Release

    ninja -C "$BUILD_DIR/$ABI" -j$(nproc)

    echo "   Stripping..."
    for bin in runsvdir runsv sv svlogd chpst runsvchdir; do
        "$STRIP" --strip-all "$BUILD_DIR/$ABI/src/$bin"
    done

    echo "   Done: $ABI"
    ls -lh "$BUILD_DIR/$ABI/src/runsvdir" 2>/dev/null
done

echo ""
echo "=== All ABIs built successfully ==="
echo "Binaries in: $BUILD_DIR/<abi>/src/"

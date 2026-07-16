# Android NDK environment setup
# Usage: source /opt/android-ndk-env.sh
#   or:  . /opt/android-ndk-env.sh

export ANDROID_NDK_HOME="/opt/android-ndk"
export ANDROID_NDK_ROOT="$ANDROID_NDK_HOME"
export NDK="$ANDROID_NDK_HOME"

NDK_TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64"
export PATH="$NDK_TOOLCHAIN/bin:$ANDROID_NDK_HOME:$PATH"

# Default target (override before sourcing or export manually)
: ${ANDROID_ABI:=arm64-v8a}
: ${ANDROID_API:=21}

# Map ABI to target triple
case "$ANDROID_ABI" in
  arm64-v8a)
    ANDROID_TARGET="aarch64-linux-android${ANDROID_API}"
    ANDROID_ARCH="arm64"
    ;;
  armeabi-v7a)
    ANDROID_TARGET="armv7a-linux-androideabi${ANDROID_API}"
    ANDROID_ARCH="arm"
    ;;
  x86_64)
    ANDROID_TARGET="x86_64-linux-android${ANDROID_API}"
    ANDROID_ARCH="x86_64"
    ;;
  x86)
    ANDROID_TARGET="i686-linux-android${ANDROID_API}"
    ANDROID_ARCH="x86"
    ;;
  riscv64)
    ANDROID_TARGET="riscv64-linux-android${ANDROID_API}"
    ANDROID_ARCH="riscv64"
    ;;
  *)
    echo "Unknown ANDROID_ABI: $ANDROID_ABI"
    echo "Valid: arm64-v8a armeabi-v7a x86_64 x86 riscv64"
    return 1
    ;;
esac

export ANDROID_ABI ANDROID_API ANDROID_TARGET ANDROID_ARCH

# Convenience aliases
alias ndk-clang="$NDK_TOOLCHAIN/bin/${ANDROID_TARGET}-clang"
alias ndk-clang++="$NDK_TOOLCHAIN/bin/${ANDROID_TARGET}-clang++"
alias ndk-strip="$NDK_TOOLCHAIN/bin/llvm-strip"
alias ndk-objdump="$NDK_TOOLCHAIN/bin/llvm-objdump"
alias ndk-readelf="$NDK_TOOLCHAIN/bin/llvm-readelf"

alias ndk-cmake="cmake -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake \
    -DANDROID_ABI=$ANDROID_ABI \
    -DANDROID_NATIVE_API_LEVEL=$ANDROID_API \
    -DANDROID_PLATFORM=android-$ANDROID_API"

echo "NDK env: ABI=$ANDROID_ABI  API=$ANDROID_API  Target=$ANDROID_TARGET"
echo "Toolchain: $NDK_TOOLCHAIN"

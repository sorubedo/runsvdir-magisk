# Standalone CMake toolchain file for Android cross-compilation
# Usage: cmake -DCMAKE_TOOLCHAIN_FILE=/opt/android-toolchain.cmake \
#              -DANDROID_ABI=arm64-v8a \
#              -DANDROID_API=21 \
#              ...

set(CMAKE_SYSTEM_NAME Android)
set(CMAKE_SYSTEM_VERSION 1)
set(CMAKE_ANDROID_NDK "$ENV{ANDROID_NDK_HOME}")
set(CMAKE_ANDROID_NDK_TOOLCHAIN_VERSION clang)

# Allow overriding via -D or environment
if(NOT DEFINED ANDROID_ABI)
  set(ANDROID_ABI "$ENV{ANDROID_ABI}" CACHE STRING "Android ABI")
endif()
if(NOT ANDROID_ABI)
  set(ANDROID_ABI arm64-v8a)
endif()

if(NOT DEFINED ANDROID_NATIVE_API_LEVEL AND NOT DEFINED ANDROID_API)
  if(DEFINED ENV{ANDROID_API})
    set(ANDROID_NATIVE_API_LEVEL "$ENV{ANDROID_API}")
    set(ANDROID_API "$ENV{ANDROID_API}")
  else()
    set(ANDROID_NATIVE_API_LEVEL 21)
    set(ANDROID_API 21)
  endif()
endif()

# Static linking produces standalone Bionic CLI binaries
option(ANDROID_STL "Use c++_static or c++_shared" "c++_static")
option(STATIC_EXECUTABLE "Link executable fully statically" ON)

message(STATUS "Android cross-compile: ABI=${ANDROID_ABI} API=${ANDROID_NATIVE_API_LEVEL}")

# For plain C CLI programs: static linking against Bionic
if(STATIC_EXECUTABLE)
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -static-libstdc++ -static-libgcc")
  # Bionic does not support fully static executables with -static easily,
  # but static-libstdc++ + static-libgcc works for most cases.
endif()

# runsvdir-magisk — Android Bionic CLI 开发环境

## 项目方向

面向 Android Bionic libc 的命令行程序开发与移植。产物为静态链接（或最小动态依赖）的 Android 原生可执行文件，适配 Magisk/KernelSU 等 root 环境下运行。

## 环境概况

- **基础镜像**: Debian 13 (trixie), x86_64
- **工具链**: NDK r27d (LLVM/Clang 18.0.4) + 宿主 Clang 19
- **NDK 路径**: `/opt/android-ndk` → `/opt/android-ndk-r27d`
- **支持的 ABI**: `arm64-v8a` `armeabi-v7a` `x86_64` `x86` `riscv64`
- **最低 API Level**: 24
- **务必查看.devcontainer/Dockerfile**

## 测试
由用户手动测试

## 环境激活

```bash
source /opt/android-ndk-env.sh   # 设置 ANDROID_NDK_HOME / PATH / 便捷别名
```

## 参考

- [Android NDK 官方文档](https://developer.android.com/ndk/guides)
- [Bionic libc 概述](https://android.googlesource.com/platform/bionic/)

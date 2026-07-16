# runsvdir-magisk

基于 Runit 的 Android 服务管理器。提供 `runsvdir`、`runsv`、`sv`、`svlogd`、`chpst`、`runsvchdir` 六个工具，静态链接，适配 Android Bionic libc，最低 API 24。

[English](README.md)

## 环境要求

- 已 root 的 Android 设备（Magisk 20.4+ 或 KernelSU）
- BusyBox（Magisk 自带）

## 支持的架构

arm64-v8a、armeabi-v7a、x86_64、x86

---

## 快速开始

安装并重启后 `runsvdir` 会自动启动。服务目录位于：
```
/data/adb/runsvdir/service/
```

---

## sv 命令详解

所有命令与原版 runit 的 `sv` 完全一致：

```
sv status  <服务名>        查看状态（run/down/finish/wait）
sv up      <服务名>        启动并保持运行
sv down    <服务名>        停止并保持停止
sv once    <服务名>        启动一次，运行结束后自动停止
sv pause   <服务名>        暂停（发送 SIGSTOP）
sv cont    <服务名>        继续（发送 SIGCONT）
sv hup     <服务名>        发送 SIGHUP
sv term    <服务名>        发送 SIGTERM
sv kill    <服务名>        发送 SIGKILL
sv restart <服务名>        重启
sv reload  <服务名>        发送 SIGHUP（同 hup）
sv exit    <服务名>        通知 runsv 退出，服务进入 wait 状态
sv check   <服务名>        检查服务是否正常运行
```

### 一次性查看所有服务

```bash
sv status /data/adb/runsvdir/service/*
```

---

## 封装脚本

```
runsvdir-magisk start            启动 runsvdir 守护进程
runsvdir-magisk stop             停止 runsvdir（同时停止所有 runsv）
runsvdir-magisk restart          重启

sv-enable  <服务名>              启用服务（删除 down 文件）并启动
sv-disable <服务名>              禁用服务（创建 down 文件）并停止
```

---

## 手动控制

```bash
# 停止所有服务
runsvdir-magisk stop

# 启动
runsvdir-magisk start

# 重启
runsvdir-magisk restart

# 检查 runsvdir 是否在运行
pgrep runsvdir
```

---

## 设备目录布局

### 模块目录
```
/data/adb/modules/runsvdir/
├── module.prop
├── system/bin/
│   ├── runsvdir
│   ├── runsv
│   ├── sv
│   ├── svlogd
│   ├── chpst
│   ├── runsvchdir
│   ├── runsvdir-magisk
│   ├── sv-enable
│   ├── sv-disable
│   └── svlogger
├── webroot/                       # WebUI（KernelSU / MMRL）
│   ├── index.html
│   ├── *.js
│   └── *.css
```

### 数据目录（持久化）
```
/data/adb/runsvdir/
├── service/                   # ← 服务目录，在此放置你的服务
│   ├── myservice/
│   │   ├── run                # 服务启动脚本（必需）
│   │   ├── finish             # 服务停止脚本（可选）
│   │   ├── check              # 健康检查脚本（可选）
│   │   ├── down               # 阻止自动启动（可选）
│   │   ├── conf               # 环境变量文件（可选）
│   │   └── log/
│   │       └── run            # 日志服务脚本（可选）
│   └── ...
├── log/sv/                    # svlogd 日志输出目录
│   └── myservice/
│       └── current            # 当前日志文件
└── run/                       # PID 文件目录
    └── runsvdir.pid
```

---

## 创建服务

在 `/data/adb/runsvdir/service/` 下创建以服务名命名的目录，编写 `run` 脚本并加执行权限即可自动运行：

```bash
mkdir /data/adb/runsvdir/service/<服务名>
```

### 一次性创建服务及日志子服务

如需日志服务，为你的服务创建 `log` 子目录：

```bash
mkdir -p /data/adb/runsvdir/service/<服务名>/log
```

### run 脚本写法

主服务 `run`：

```bash
#!/system/bin/sh
exec 2>&1
exec your_program   # 必须保持前台阻塞
```

日志子服务 `log/run`：

```bash
#!/system/bin/sh
mkdir -p /data/adb/runsvdir/log/sv/<服务名>
exec svlogd -tt /data/adb/runsvdir/log/sv/<服务名>
```

也可直接使用内置的 `svlogger` 脚本：`log/run` 内容只需 `#!/system/bin/sh` + `exec svlogger`。

```bash
chmod +x /data/adb/runsvdir/service/<服务名>/run
chmod +x /data/adb/runsvdir/service/<服务名>/log/run   # 如有日志
```

脚本就绪后 runsvdir 会自动拉起运行。

### 模块自带服务

模块可将服务放置在 `/data/adb/modules/<模块id>/sv/` 中，通过符号链接启用：

```
/data/adb/modules/<模块id>/
└── sv/
    └── <服务名>/
        ├── run
        └── log/
            └── run
```

```bash
ln -s /data/adb/modules/<模块id>/sv/<服务名> /data/adb/runsvdir/service/<服务名>
```

---

## WebUI

本模块附带 WebUI，可在 KernelSU / MMRL 管理器中使用，提供：

- **Services** 标签 — 查看所有已激活服务的运行状态、PID、运行时长；执行 up / down / restart / enable / disable
- **Definitions** 标签 — 浏览所有模块的服务定义（`/data/adb/modules/*/sv/`）；通过符号链接启用/禁用服务

WebUI 使用纯 HTML/CSS/JS 编写，由 [Parcel](https://parceljs.org/) 打包。源码位于 `webui/`，构建输出到 `magisk/webroot/`。

```bash
npm run build     # 打包 WebUI → magisk/webroot/
```

---

## 许可

Runit (BSD 3-Clause)。源码基于 [grimler/runit](https://git.sr.ht/~grimler/runit)。

使用 OpenCode + DeepSeek V4 PRO 修改移植。

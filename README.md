# runsvdir-magisk

A Runit-based Android service manager. Packages Termux-prebuild `runsvdir`, `runsv`, `sv`, `svlogd`, `chpst`, `runsvchdir` binaries into a Magisk/KernelSU module for persistent service supervision.

## 2.0.0

Refactored around a single responsibility: install the runit tools and start `runsvdir` at boot. Service definitions and links remain user-managed.

[中文文档](README_zh.md)

## Requirements

- Rooted Android device (Magisk 20.4+ or KernelSU)

## Supported ABIs

Download the ZIP matching the device architecture:

| ZIP suffix | Android / Magisk architecture | Termux binary architecture |
|---|---|---|
| `arm64-v8a` | arm64 | aarch64 |
| `armeabi-v7a` | arm | arm |
| `x86_64` | x64 | x86_64 |
| `x86` | x86 | i686 |

---

## Quick Start

After installation and reboot, `runsvdir` starts automatically. The service directory is:

```
/data/adb/runsvdir/service/
```

Set `SVDIR=/data/adb/runsvdir/service` when using service names with `sv`, `sv-enable` or `sv-disable`; `sv` also accepts a full service path.

---

## sv Command Reference

All commands match upstream runit `sv`:

```
sv status  <service>        show status (run/down/finish/wait)
sv up      <service>        start and keep running
sv down    <service>        stop and keep stopped
sv once    <service>        start once, stop after exit
sv pause   <service>        pause (send SIGSTOP)
sv cont    <service>        continue (send SIGCONT)
sv hup     <service>        send SIGHUP
sv term    <service>        send SIGTERM
sv kill    <service>        send SIGKILL
sv restart <service>        restart
sv reload  <service>        send SIGHUP (same as hup)
sv exit    <service>        tell runsv to exit, enter wait state
sv check   <service>        check health status
```

### Check all services at once

```bash
sv status /data/adb/runsvdir/service/*
```

---

## Wrapper Scripts

```
runsvdir-magisk start             start runsvdir daemon
runsvdir-magisk stop              stop runsvdir (also stops all runsv)
runsvdir-magisk restart           restart

sv-enable  <service>              enable service (remove down file) and start
sv-disable <service>              disable service (create down file) and stop
```

---

## Manual Control

```bash
# Stop all services
runsvdir-magisk stop

# Start
runsvdir-magisk start

# Restart
runsvdir-magisk restart

# Check if runsvdir is running
pgrep runsvdir
```

---

## Device Directory Layout

### Module directory

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
│   └── sv-disable
```

### Data directory (persistent)

```
/data/adb/runsvdir/
├── service/                      # ← put your services here
│   ├── myservice/
│   │   ├── run                   # start script (required)
│   │   ├── finish                # stop script (optional)
│   │   ├── check                 # health check (optional)
│   │   ├── down                  # prevent auto-start (optional)
│   │   ├── conf                  # env vars (optional)
│   │   └── log/
│   │       └── run               # log service script (optional)
│   └── ...
├── log/sv/                       # svlogd log output
│   └── myservice/
│       └── current               # current log file
└── run/                          # PID files
    └── runsvdir.pid
```

---

## Creating a Service

Create a directory under `/data/adb/runsvdir/service/` named after your service, write a `run` script, and make it executable. runsvdir will pick it up automatically:

```bash
mkdir /data/adb/runsvdir/service/<svc-name>
```

### Adding a log sub-service

```bash
mkdir -p /data/adb/runsvdir/service/<svc-name>/log
```

### run script examples

Main service `run`:

```bash
#!/system/bin/sh
exec 2>&1
exec your_program   # must stay foreground (blocking)
```

Log sub-service `log/run`:

```bash
#!/system/bin/sh
mkdir -p /data/adb/runsvdir/log/sv/<svc-name>
exec svlogd -tt /data/adb/runsvdir/log/sv/<svc-name>
```


```bash
chmod +x /data/adb/runsvdir/service/<svc-name>/run
chmod +x /data/adb/runsvdir/service/<svc-name>/log/run   # if logging
```

Once the scripts are ready, runsvdir will launch them automatically.

---

## Build

```bash
./dl-bins.sh      # download Termux runit binaries for all ABIs
./package.sh      # create one out/runsvdir-magisk-<version>-<abi>.zip per ABI
```

Each ZIP contains only one ABI. Pass one or more ABI names to `package.sh` to build only those targets.

---

## License

This project (shell scripts, module packaging) — [MIT](LICENSE).

Bundled runit binaries from [Termux's runit package](https://github.com/termux/termux-packages/tree/master/packages/runit) (based on [grimler/runit](https://git.sr.ht/~grimler/runit)) — BSD 3-Clause.

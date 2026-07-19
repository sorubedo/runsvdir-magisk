# runsvdir-magisk

A Runit-based Android service manager. Packages Termux-prebuild `runsvdir`, `runsv`, `sv`, `svlogd`, `chpst`, `runsvchdir` binaries into a Magisk/KernelSU module for persistent service supervision.

[中文文档](README_zh.md)

## Requirements

- Rooted Android device (Magisk 20.4+ or KernelSU)
- BusyBox (bundled with Magisk)

## Supported ABIs

aarch64, arm, x86_64, i686 (x86)

---

## Quick Start

After installation and reboot, `runsvdir` starts automatically. The service directory is:

```
/data/adb/runsvdir/service/
```

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
│   ├── sv                       # wrapper (sets SVDIR → .runit/sv)
│   ├── .runit/sv                # real sv binary
│   ├── svlogd
│   ├── chpst
│   ├── runsvchdir
│   ├── runsvdir-magisk
│   ├── sv-enable
│   └── sv-disable
├── webroot/                      # WebUI (KernelSU / MMRL)
│   ├── index.html
│   ├── *.js
│   └── *.css
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

### Module-provided services

Modules can place service definitions in `/data/adb/modules/<module_id>/sv/` and enable them via symlinks:

```
/data/adb/modules/<module_id>/
└── sv/
    └── <svc-name>/
        ├── run
        └── log/
            └── run
```

```bash
ln -s /data/adb/modules/<module_id>/sv/<svc-name> /data/adb/runsvdir/service/<svc-name>
```

### Unified service directory

A persistent, merge-friendly service directory is provided at `/data/adb/sv/`. Unlike module-specific `sv/` directories — which are replaced entirely on module update/install — this directory is shared across all modules and **persists across module updates**. User modifications (e.g., `down` files, custom `conf`) placed here will never be lost.

```
/data/adb/sv/
├── myservice/
│   ├── run
│   └── conf
└── ...
```

All service definitions from `/data/adb/sv/` appear in the WebUI's **Definitions** tab with a `(unified)` label.

### For module developers — using the unified directory

If your module ships services into `/data/adb/sv/`, you must use **merge-copy** (not directory replacement) to avoid wiping other modules' services. Implement this in your module's `customize.sh` and `uninstall.sh`:

**`customize.sh`** (installation):

```bash
# Copy services into the unified directory (merge, don't replace)
cp -r "$MODPATH/service/"* /data/adb/sv/ 2>/dev/null
```

**`uninstall.sh`** (removal):

```bash
# Remove only your own service directories from the unified directory
rm -rf /data/adb/sv/<your-service-name>
```

---

## WebUI

This module includes a WebUI for KernelSU / MMRL manager apps. It provides:

- **Services** tab — view all active services with status, PID, uptime; up / down / restart / enable / disable
- **Definitions** tab — browse service definitions from all modules (`/data/adb/modules/*/sv/`) and the unified directory (`/data/adb/sv/`); link / unlink them into the active service directory

The WebUI is built with vanilla HTML/CSS/JS and bundled with [Parcel](https://parceljs.org/). Source files are in `webui/`, built output goes to `magisk/webroot/`.

```bash
npm run build     # bundle WebUI → magisk/webroot/
```

---

## License

This project (shell scripts, WebUI, module packaging) — [MIT](LICENSE).

Bundled runit binaries from [Termux's runit package](https://github.com/termux/termux-packages/tree/master/packages/runit) (based on [grimler/runit](https://git.sr.ht/~grimler/runit)) — BSD 3-Clause.

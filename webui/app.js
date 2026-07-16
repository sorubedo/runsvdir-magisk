import { exec } from 'kernelsu';

var SVDIR = '/data/adb/runsvdir/service';
var PIDFILE = '/data/adb/runsvdir/run/runsvdir.pid';
var REFRESH_MS = 5000;
var refreshTimer = null;
var refreshing = false;

function escapeSh(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

async function sh(cmd) {
  try {
    var result = await exec(cmd + ' 2>&1');
    return {
      stdout: (result.stdout || '').trim(),
      errno: result.errno || 0
    };
  } catch (_e) {
    return { stdout: '', errno: -1 };
  }
}

function toast(msg, isError) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.classList.remove('hidden');
  clearTimeout(el._tid);
  el._tid = setTimeout(function () { el.classList.add('hidden'); }, 2000);
}

// --- Daemon ---

async function checkDaemon() {
  var r = await sh(
    '[ -f ' + escapeSh(PIDFILE) + ' ] && kill -0 $(cat ' + escapeSh(PIDFILE) + ') 2>/dev/null && echo 1 || echo 0'
  );
  return r.stdout === '1';
}

function renderDaemon(running) {
  var badge = document.getElementById('daemon-badge');
  if (running) {
    badge.textContent = 'daemon running';
    badge.className = 'badge badge-up';
  } else {
    badge.textContent = 'daemon stopped';
    badge.className = 'badge badge-down';
  }
}

// --- Services ---

async function listServiceNames() {
  var r = await sh('ls -1d ' + escapeSh(SVDIR) + '/*/ 2>/dev/null');
  if (!r.stdout) return [];
  return r.stdout.split('\n').map(function (line) {
    return line.replace(/\/$/, '').split('/').pop();
  }).filter(Boolean);
}

async function getServiceMeta(name) {
  var path = SVDIR + '/' + name;
  var r = await sh(
    'l=""; [ -L ' + escapeSh(path) + ' ] && l=$(readlink ' + escapeSh(path) + '); ' +
    'w=""; [ -f ' + escapeSh(path) + '/down ] && w=1; ' +
    'echo "${l}|${w}"'
  );
  var parts = (r.stdout || '|').split('|');
  return {
    isLink: parts[0] !== '',
    target: parts[0] || '',
    hasDown: parts[1] === '1'
  };
}

async function checkHasLog(name) {
  var r = await sh('[ -f ' + escapeSh(SVDIR + '/' + name + '/log/run') + ' ] && echo 1 || echo 0');
  return r.stdout === '1';
}

function parseStatus(name, text) {
  var result = {
    name: name,
    state: 'unknown',
    pid: null,
    uptime: 0,
    extra: '',
    logState: null,
    logPid: null,
    logUptime: 0,
    error: null
  };
  if (!text) return result;

  var mainPart = text.split(';')[0].trim();

  var errMatch = mainPart.match(/^(fail|warn):\s+(.+?):\s+(.+)/);
  if (errMatch) {
    result.state = errMatch[1];
    result.error = errMatch[3];
    return result;
  }

  var re = /^(run|down|finish|wait):\s+(.+?):\s+(?:\(pid\s+(\d+)\)\s+)?(\d+)s(?:,\s*(.*))?/;
  var m = mainPart.match(re);
  if (m) {
    result.state = m[1];
    result.pid = m[3] ? parseInt(m[3], 10) : null;
    result.uptime = parseInt(m[4], 10);
    result.extra = (m[5] || '').trim();
  }

  var logPart = text.split(';').slice(1).join(';').trim();
  if (logPart) {
    var lm = logPart.match(/^(run|down|finish|wait):\s+.*?\/log:\s+(?:\(pid\s+(\d+)\)\s+)?(\d+)s/);
    if (lm) {
      result.logState = lm[1];
      result.logPid = lm[2] ? parseInt(lm[2], 10) : null;
      result.logUptime = parseInt(lm[3], 10);
    }
  }

  return result;
}

async function getServiceStatus(name) {
  var r = await sh('sv status ' + escapeSh(name));
  return parseStatus(name, r.stdout);
}

async function getAllServices() {
  var names = await listServiceNames();
  var svcs = await Promise.all(names.map(async function (name) {
    var parts = await Promise.all([getServiceMeta(name), getServiceStatus(name)]);
    var meta = parts[0], status = parts[1];
    var hasLog = await checkHasLog(name);
    return Object.assign({ name: name }, meta, status, { hasLog: hasLog });
  }));
  return svcs;
}

// --- Definitions ---

async function getDefinitions() {
  var cmd1 = 'for d in /data/adb/modules/*/sv/*/; do [ -d "$d" ] && echo "$d"; done 2>/dev/null';
  var cmd2 = 'for d in /data/adb/sv/*/; do [ -d "$d" ] && echo "$d"; done 2>/dev/null';
  var r1 = await sh(cmd1);
  var r2 = await sh(cmd2);
  var defs = [];
  var seen = {};

  if (r1.stdout) {
    var lines = r1.stdout.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/\/data\/adb\/modules\/(.+?)\/sv\/(.+?)\/$/);
      if (m && m[2] !== 'log') {
        seen[m[2]] = true;
        defs.push({ source: 'module', module: m[1], name: m[2] });
      }
    }
  }

  if (r2.stdout) {
    var lines2 = r2.stdout.split('\n');
    for (var j = 0; j < lines2.length; j++) {
      var m2 = lines2[j].match(/\/data\/adb\/sv\/(.+?)\/$/);
      if (m2 && !seen[m2[1]] && m2[1] !== 'log') {
        seen[m2[1]] = true;
        defs.push({ source: 'unified', module: 'sv', name: m2[1] });
      }
    }
  }

  return defs;
}

function getDefPath(def) {
  if (def.source === 'unified') return '/data/adb/sv/' + def.name;
  return '/data/adb/modules/' + def.module + '/sv/' + def.name;
}

// --- Actions ---

var actionMap = {
  up:      'sv up ',
  down:    'sv down ',
  restart: 'sv restart ',
  enable:  'rm -f {path}/down && sv up ',
  disable: 'touch {path}/down && sv down '
};

async function svAction(name, action) {
  var path = SVDIR + '/' + name;
  var cmd = actionMap[action].replace('{path}', escapeSh(path)) + escapeSh(name);
  var r = await sh(cmd);
  return r.errno === 0;
}

async function linkDef(def) {
  var targetPath = SVDIR + '/' + def.name;
  var src = escapeSh(getDefPath(def));
  var tgt = escapeSh(targetPath);

  var r = await sh('[ -e ' + tgt + ' ] && echo 1 || echo 0');
  if (r.stdout === '1') {
    var r2 = await sh('[ -L ' + tgt + ' ] && echo 1 || echo 0');
    if (r2.stdout === '1') {
      await sh('rm ' + tgt);
    } else {
      return false;
    }
  }
  var r3 = await sh('ln -sf ' + src + ' ' + tgt);
  return r3.errno === 0;
}

async function unlinkService(name) {
  var path = SVDIR + '/' + name;
  var r = await sh('[ -L ' + escapeSh(path) + ' ] && echo 1 || echo 0');
  if (r.stdout !== '1') return false;
  var r2 = await sh('rm ' + escapeSh(path));
  return r2.errno === 0;
}

// --- Render helpers ---

var stateClassMap = { run: 'badge-up', down: 'badge-down', finish: 'badge-finish', wait: 'badge-down' };

function formatUptime(s) {
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  return h + 'h ' + m + 'm';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderServiceCard(svc) {
  var cls = stateClassMap[svc.state] || 'badge-dim';
  var label = svc.error ? 'error' : svc.state;
  var typeTag = svc.isLink
    ? '<span class="tag">symlink &rarr; ' + esc(svc.target) + '</span>'
    : '<span class="tag">manual</span>';

  var parts = [];
  if (svc.pid) parts.push('pid ' + svc.pid);
  if (svc.uptime > 0 || svc.state === 'run') parts.push(formatUptime(svc.uptime));
  if (svc.extra) parts.push(svc.extra);
  if (svc.hasDown) {
    parts.push('<span class="badge badge-down sbadge">disabled</span>');
  } else if (svc.state !== 'unknown' && svc.state !== 'fail' && svc.state !== 'warn') {
    parts.push('<span class="badge badge-up sbadge">enabled</span>');
  }
  if (svc.error) {
    parts.push('<span class="badge badge-down sbadge">' + esc(svc.error) + '</span>');
  }

  var sep = '<span class="sep">|</span>';
  var n = attr(svc.name);

  var subHtml = '';
  if (svc.hasLog) {
    var lName = svc.name + '/log';
    var ln = attr(lName);
    var lState = svc.logState || 'down';
    var lCls = stateClassMap[lState] || 'badge-down';
    var lMeta = [];
    if (svc.logPid) lMeta.push('pid ' + svc.logPid);
    if (svc.logUptime > 0) lMeta.push(formatUptime(svc.logUptime));
    subHtml = [
      '<div class="subsvc">',
      '<div class="subsvc-header">',
      '<span class="subsvc-title">log</span>',
      '<span class="badge ' + lCls + '">' + lState + '</span>',
      '</div>',
      lMeta.length ? '<div class="subsvc-meta">' + lMeta.join(sep) + '</div>' : '',
      '<div class="subsvc-actions">',
      '<button class="btn btn-green" data-svc="' + ln + '" data-act="up">Up</button>',
      '<button class="btn btn-red" data-svc="' + ln + '" data-act="down">Down</button>',
      '<button class="btn btn-accent" data-svc="' + ln + '" data-act="restart">Restart</button>',
      '</div>',
      '</div>'
    ].join('');
  }

  return [
    '<div class="card">',
    '<div class="card-header">',
    '<span class="card-title">' + esc(svc.name) + '</span>',
    '<span class="badge ' + cls + '">' + label + '</span>',
    '</div>',
    '<div class="card-meta">',
    typeTag,
    parts.length ? sep + parts.join(sep) : '',
    '</div>',
    '<div class="card-actions">',
    '<button class="btn btn-green" data-svc="' + n + '" data-act="up">Up</button>',
    '<button class="btn btn-red" data-svc="' + n + '" data-act="down">Down</button>',
    '<button class="btn btn-accent" data-svc="' + n + '" data-act="restart">Restart</button>',
    svc.hasDown
      ? '<button class="btn btn-green" data-svc="' + n + '" data-act="enable">Enable</button>'
      : '<button class="btn btn-red" data-svc="' + n + '" data-act="disable">Disable</button>',
    '</div>',
    subHtml,
    '</div>'
  ].join('');
}

function renderDefCard(def, linked) {
  var n = attr(def.name);
  var m = attr(def.module);
  var src = attr(def.source);
  var tagLabel = esc(def.module) + (def.source === 'unified' ? ' (unified)' : '');
  return [
    '<div class="card' + (linked ? ' def-linked' : '') + '">',
    '<div class="card-header">',
    '<span class="card-title">' + esc(def.name) + '</span>',
    '<span class="badge ' + (linked ? 'badge-up' : 'badge-dim') + '">' + (linked ? 'linked' : 'unlinked') + '</span>',
    '</div>',
    '<div class="card-meta">',
    '<span class="tag">' + tagLabel + '</span>',
    '</div>',
    '<div class="card-actions">',
    linked
      ? '<button class="btn btn-red" data-def="' + n + '" data-act="unlink">Unlink</button>'
      : '<button class="btn btn-accent2" data-def="' + n + '" data-defmod="' + m + '" data-defsrc="' + src + '" data-act="link">Link</button>',
    '</div>',
    '</div>'
  ].join('');
}

// --- Main render ---

async function renderServices() {
  var list = document.getElementById('service-list');
  var empty = document.getElementById('services-empty');
  var bar = document.getElementById('stats-bar');

  try {
    var services = await getAllServices();
    if (!services.length) {
      list.innerHTML = '';
      bar.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');

      var running = 0, down = 0;
      for (var i = 0; i < services.length; i++) {
        if (services[i].state === 'run') running++;
        else if (services[i].state === 'down') down++;
      }
      bar.innerHTML = [
        '<span><span class="stat-val">' + services.length + '</span> total</span>',
        '<span><span class="stat-val">' + running + '</span> running</span>',
        '<span><span class="stat-val">' + down + '</span> stopped</span>'
      ].join('');

      var html = [];
      for (var j = 0; j < services.length; j++) {
        html.push(renderServiceCard(services[j]));
      }
      list.innerHTML = html.join('');
    }
  } catch (e) {
    list.innerHTML = '';
    bar.innerHTML = '';
    empty.classList.remove('hidden');
    empty.textContent = 'Error loading services: ' + e.message;
  }
}

async function renderDefinitions() {
  var list = document.getElementById('def-list');
  var empty = document.getElementById('defs-empty');

  try {
    var names = await listServiceNames();
    var activeMap = {};
    for (var i = 0; i < names.length; i++) activeMap[names[i]] = true;

    var defs = await getDefinitions();
    if (!defs.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      var html = [];
      for (var j = 0; j < defs.length; j++) {
        html.push(renderDefCard(defs[j], !!activeMap[defs[j].name]));
      }
      list.innerHTML = html.join('');
    }
  } catch (e) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.textContent = 'Error loading definitions: ' + e.message;
  }
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    var running = await checkDaemon();
    renderDaemon(running);
    await Promise.all([renderServices(), renderDefinitions()]);
  } finally {
    refreshing = false;
  }
}

// --- Event bindings ---

function bindTabs() {
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      var target = this.dataset.tab;
      var allTabs = document.querySelectorAll('.tab');
      for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
      var allPanels = document.querySelectorAll('.tab-content');
      for (var k = 0; k < allPanels.length; k++) allPanels[k].classList.remove('active');
      this.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    });
  }
}

function bindServiceActions() {
  document.getElementById('service-list').addEventListener('click', async function (e) {
    var btn = e.target.closest('button[data-svc]');
    if (!btn) return;
    var name = btn.dataset.svc;
    var act = btn.dataset.act;
    var labels = { up: 'Starting ', down: 'Stopping ', restart: 'Restarting ', enable: 'Enabling ', disable: 'Disabling ' };
    var ok = await svAction(name, act);
    toast(labels[act] + name + (ok ? ' OK' : ' failed'), !ok);
    if (ok) refresh();
  });
}

function bindDefActions() {
  document.getElementById('def-list').addEventListener('click', async function (e) {
    var btn = e.target.closest('button[data-def]');
    if (!btn) return;
    var name = btn.dataset.def;
    var act = btn.dataset.act;

    if (act === 'link') {
      var mod = btn.dataset.defmod;
      var src = btn.dataset.defsrc;
      var ok = await linkDef({ name: name, module: mod, source: src });
      toast('Linking ' + name + (ok ? ' OK' : ' failed'), !ok);
    } else if (act === 'unlink') {
      var ok = await unlinkService(name);
      toast('Unlinking ' + name + (ok ? ' OK' : ' failed'), !ok);
    }
    refresh();
  });
}

// --- Init ---

function init() {
  bindTabs();
  document.getElementById('btn-refresh').addEventListener('click', refresh);
  bindServiceActions();
  bindDefActions();
  refresh();
  refreshTimer = setInterval(refresh, REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);

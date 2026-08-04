import { exec } from 'kernelsu';
import {
  Activity,
  Blocks,
  CircleAlert,
  FolderSearch,
  Inbox,
  Link2,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  RotateCw,
  ScrollText,
  Square,
  SquareTerminal,
  Terminal,
  Unlink,
  createIcons
} from 'lucide';

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
  var card = document.getElementById('summary-card');
  var state = document.getElementById('daemon-state');
  var detail = document.getElementById('daemon-detail');
  if (running) {
    badge.textContent = 'Daemon running';
    badge.className = 'daemon-label daemon-up';
    card.classList.remove('daemon-offline');
    state.textContent = 'Supervisor online';
    detail.textContent = 'runsvdir is monitoring the active service directory';
  } else {
    badge.textContent = 'Daemon stopped';
    badge.className = 'daemon-label daemon-down';
    card.classList.add('daemon-offline');
    state.textContent = 'Supervisor offline';
    detail.textContent = 'Service changes will not be supervised until it starts';
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
    var lm = logPart.match(/^(run|down|finish|wait):\s+log:\s+(?:\(pid\s+(\d+)\)\s+)?(\d+)s/);
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

async function checkLogDown(name) {
  var r = await sh('[ -f ' + escapeSh(SVDIR + '/' + name + '/log/down') + ' ] && echo 1 || echo 0');
  return r.stdout === '1';
}

async function getAllServices() {
  var names = await listServiceNames();
  var svcs = await Promise.all(names.map(async function (name) {
    var parts = await Promise.all([getServiceMeta(name), getServiceStatus(name), checkHasLog(name)]);
    var meta = parts[0], status = parts[1], hasLog = parts[2];
    var logHasDown = hasLog ? await checkLogDown(name) : false;
    return Object.assign({ name: name }, meta, status, { hasLog: hasLog, logHasDown: logHasDown });
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

var iconSet = {
  Activity: Activity,
  Blocks: Blocks,
  CircleAlert: CircleAlert,
  FolderSearch: FolderSearch,
  Inbox: Inbox,
  Link2: Link2,
  Play: Play,
  Power: Power,
  PowerOff: PowerOff,
  RefreshCw: RefreshCw,
  RotateCw: RotateCw,
  ScrollText: ScrollText,
  Square: Square,
  SquareTerminal: SquareTerminal,
  Terminal: Terminal,
  Unlink: Unlink
};

var stateViewMap = {
  run: { card: 'status-running', chip: 'running', label: 'Running', icon: 'activity' },
  down: { card: 'status-stopped', chip: 'stopped', label: 'Stopped', icon: 'square' },
  wait: { card: 'status-stopped', chip: 'stopped', label: 'Waiting', icon: 'square' },
  finish: { card: 'status-warning', chip: 'warning', label: 'Finished', icon: 'circle-alert' },
  warn: { card: 'status-warning', chip: 'warning', label: 'Warning', icon: 'circle-alert' },
  fail: { card: 'status-error', chip: 'error', label: 'Error', icon: 'circle-alert' },
  unknown: { card: 'status-neutral', chip: '', label: 'Unknown', icon: 'activity' }
};

var actionViewMap = {
  up: { label: 'Start', icon: 'play', cls: 'action-positive' },
  down: { label: 'Stop', icon: 'square', cls: 'action-danger' },
  restart: { label: 'Restart', icon: 'rotate-cw', cls: 'action-primary' },
  enable: { label: 'Enable', icon: 'power', cls: 'action-positive' },
  disable: { label: 'Disable', icon: 'power-off', cls: 'action-danger' }
};

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

function renderIcons() {
  createIcons({ icons: iconSet });
}

function icon(name) {
  return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
}

function getStateView(state, hasError) {
  if (hasError) return stateViewMap.fail;
  return stateViewMap[state] || stateViewMap.unknown;
}

function renderMeta(parts, className) {
  var html = [];
  for (var i = 0; i < parts.length; i++) {
    html.push('<span' + (i ? ' class="meta-dot"' : '') + '>' + parts[i] + '</span>');
  }
  return '<div class="' + className + '">' + html.join('') + '</div>';
}

function renderServiceAction(name, action) {
  var view = actionViewMap[action];
  var label = view.label + ' ' + name;
  return [
    '<button type="button" class="action-button ' + view.cls + '"',
    ' data-svc="' + attr(name) + '" data-act="' + action + '"',
    ' title="' + attr(label) + '" aria-label="' + attr(label) + '">',
    icon(view.icon),
    '</button>'
  ].join('');
}

function renderServiceActions(name, isDisabled) {
  return [
    '<div class="card-actions" role="group" aria-label="Actions for ' + attr(name) + '">',
    renderServiceAction(name, 'up'),
    renderServiceAction(name, 'down'),
    renderServiceAction(name, 'restart'),
    renderServiceAction(name, isDisabled ? 'enable' : 'disable'),
    '</div>'
  ].join('');
}

function renderServiceCard(svc) {
  var view = getStateView(svc.state, svc.error);
  var parts = [];
  if (svc.pid) parts.push('PID ' + svc.pid);
  if (svc.uptime > 0 || svc.state === 'run') parts.push('Uptime ' + formatUptime(svc.uptime));
  if (svc.extra) parts.push(esc(svc.extra));
  parts.push(svc.hasDown ? 'Disabled at boot' : 'Enabled at boot');
  if (svc.error) parts.push(esc(svc.error));

  var origin = svc.isLink ? svc.target : 'Manual service directory';
  var originIcon = svc.isLink ? 'link-2' : 'folder-search';
  var subHtml = '';

  if (svc.hasLog) {
    var logName = svc.name + '/log';
    var logState = svc.logState || 'down';
    var logView = getStateView(logState, false);
    var logMeta = [];
    if (svc.logPid) logMeta.push('PID ' + svc.logPid);
    if (svc.logUptime > 0 || logState === 'run') logMeta.push('Uptime ' + formatUptime(svc.logUptime));
    logMeta.push(svc.logHasDown ? 'Disabled at boot' : 'Enabled at boot');

    subHtml = [
      '<section class="subsvc" aria-label="Log service for ' + attr(svc.name) + '">',
      '<div class="subsvc-header">',
      '<span class="subsvc-symbol">' + icon('scroll-text') + '</span>',
      '<div class="subsvc-copy">',
      '<div class="subsvc-title-row">',
      '<h4 class="subsvc-title">Log service</h4>',
      '<span class="status-chip ' + logView.chip + '">' + logView.label + '</span>',
      '</div>',
      renderMeta(logMeta, 'subsvc-meta'),
      '</div>',
      '</div>',
      renderServiceActions(logName, svc.logHasDown),
      '</section>'
    ].join('');
  }

  return [
    '<article class="service-card ' + view.card + '">',
    '<div class="service-header">',
    '<span class="service-symbol">' + icon(view.icon) + '</span>',
    '<div class="service-copy">',
    '<div class="service-title-row">',
    '<h3 class="service-title">' + esc(svc.name) + '</h3>',
    '<span class="status-chip ' + view.chip + '">' + view.label + '</span>',
    '</div>',
    renderMeta(parts, 'service-meta'),
    '</div>',
    '</div>',
    '<div class="service-origin">' + icon(originIcon) + '<span>' + esc(origin) + '</span></div>',
    renderServiceActions(svc.name, svc.hasDown),
    subHtml,
    '</article>'
  ].join('');
}

function renderDefCard(def, linked) {
  var name = attr(def.name);
  var moduleName = attr(def.module);
  var source = attr(def.source);
  var sourceLabel = def.source === 'unified' ? 'Unified directory' : 'Module ' + esc(def.module);
  var actionLabel = (linked ? 'Unlink ' : 'Link ') + def.name;
  var actionHtml = linked
    ? '<button type="button" class="action-button action-danger" data-def="' + name + '" data-act="unlink" title="' + attr(actionLabel) + '" aria-label="' + attr(actionLabel) + '">' + icon('unlink') + '</button>'
    : '<button type="button" class="action-button action-primary" data-def="' + name + '" data-defmod="' + moduleName + '" data-defsrc="' + source + '" data-act="link" title="' + attr(actionLabel) + '" aria-label="' + attr(actionLabel) + '">' + icon('link-2') + '</button>';

  return [
    '<article class="definition-card">',
    '<div class="definition-main">',
    '<span class="definition-symbol' + (linked ? ' linked' : '') + '">' + icon(linked ? 'link-2' : 'blocks') + '</span>',
    '<div class="definition-copy">',
    '<div class="definition-title-row">',
    '<h3 class="definition-title">' + esc(def.name) + '</h3>',
    '<span class="status-chip ' + (linked ? 'linked' : '') + '">' + (linked ? 'Linked' : 'Available') + '</span>',
    '</div>',
    '<div class="definition-meta">' + sourceLabel + '</div>',
    '</div>',
    '<div class="definition-action">' + actionHtml + '</div>',
    '</div>',
    '</article>'
  ].join('');
}

// --- Main render ---

async function renderServices() {
  var list = document.getElementById('service-list');
  var empty = document.getElementById('services-empty');
  var bar = document.getElementById('stats-bar');
  if (empty._defaultHtml) empty.innerHTML = empty._defaultHtml;

  try {
    var services = await getAllServices();
    var running = 0;
    var stopped = 0;
    for (var i = 0; i < services.length; i++) {
      if (services[i].state === 'run') running++;
      else stopped++;
    }
    bar.innerHTML = [
      '<div class="metric"><strong>' + services.length + '</strong><span>Total</span></div>',
      '<div class="metric"><strong>' + running + '</strong><span>Running</span></div>',
      '<div class="metric"><strong>' + stopped + '</strong><span>Stopped</span></div>'
    ].join('');

    if (!services.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      var html = [];
      for (var j = 0; j < services.length; j++) {
        html.push(renderServiceCard(services[j]));
      }
      list.innerHTML = html.join('');
    }
  } catch (e) {
    list.innerHTML = '';
    bar.innerHTML = [
      '<div class="metric"><strong>0</strong><span>Total</span></div>',
      '<div class="metric"><strong>0</strong><span>Running</span></div>',
      '<div class="metric"><strong>0</strong><span>Stopped</span></div>'
    ].join('');
    empty.classList.remove('hidden');
    empty.innerHTML = '<span class="empty-icon">' + icon('circle-alert') + '</span><h3>Could not load services</h3><p>' + esc(e.message) + '</p>';
  }
}

async function renderDefinitions() {
  var list = document.getElementById('def-list');
  var empty = document.getElementById('defs-empty');
  if (empty._defaultHtml) empty.innerHTML = empty._defaultHtml;

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
    empty.innerHTML = '<span class="empty-icon">' + icon('circle-alert') + '</span><h3>Could not load definitions</h3><p>' + esc(e.message) + '</p>';
  }
}

async function refresh() {
  if (refreshing) return;
  var button = document.getElementById('btn-refresh');
  refreshing = true;
  button.disabled = true;
  button.classList.add('is-refreshing');
  button.setAttribute('aria-busy', 'true');
  try {
    var running = await checkDaemon();
    renderDaemon(running);
    await Promise.all([renderServices(), renderDefinitions()]);
  } finally {
    refreshing = false;
    button.disabled = false;
    button.classList.remove('is-refreshing');
    button.removeAttribute('aria-busy');
    renderIcons();
  }
}

// --- Event bindings ---

function bindTabs() {
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      var target = this.dataset.tab;
      var allTabs = document.querySelectorAll('.tab');
      for (var j = 0; j < allTabs.length; j++) {
        allTabs[j].classList.remove('active');
        allTabs[j].setAttribute('aria-selected', 'false');
      }
      var allPanels = document.querySelectorAll('.tab-content');
      for (var k = 0; k < allPanels.length; k++) allPanels[k].classList.remove('active');
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      document.getElementById('tab-' + target).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    btn.disabled = true;
    var ok = await svAction(name, act);
    toast(labels[act] + name + (ok ? ' OK' : ' failed'), !ok);
    if (ok) await refresh();
    if (btn.isConnected) btn.disabled = false;
  });
}

function bindDefActions() {
  document.getElementById('def-list').addEventListener('click', async function (e) {
    var btn = e.target.closest('button[data-def]');
    if (!btn) return;
    var name = btn.dataset.def;
    var act = btn.dataset.act;
    btn.disabled = true;

    if (act === 'link') {
      var mod = btn.dataset.defmod;
      var src = btn.dataset.defsrc;
      var ok = await linkDef({ name: name, module: mod, source: src });
      toast('Linking ' + name + (ok ? ' OK' : ' failed'), !ok);
    } else if (act === 'unlink') {
      var ok = await unlinkService(name);
      toast('Unlinking ' + name + (ok ? ' OK' : ' failed'), !ok);
    }
    await refresh();
    if (btn.isConnected) btn.disabled = false;
  });
}

// --- Init ---

function init() {
  var emptyStates = document.querySelectorAll('.empty-state');
  for (var i = 0; i < emptyStates.length; i++) emptyStates[i]._defaultHtml = emptyStates[i].innerHTML;
  bindTabs();
  document.getElementById('btn-refresh').addEventListener('click', refresh);
  bindServiceActions();
  bindDefActions();
  renderIcons();
  refresh();
  refreshTimer = setInterval(refresh, REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);

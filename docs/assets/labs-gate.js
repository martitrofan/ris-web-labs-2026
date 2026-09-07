(function () {
  'use strict';

  var catalog = null;
  var catalogPromise = null;

  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch('labs.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('labs.json: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        catalog = data;
        return catalog;
      });
    return catalogPromise;
  }

  function getUnlocks(storageKey) {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    } catch (e) {
      return {};
    }
  }

  function setUnlock(storageKey, labId) {
    var map = getUnlocks(storageKey);
    map[labId] = true;
    sessionStorage.setItem(storageKey, JSON.stringify(map));
  }

  /** Route without #, leading slash, .md, trailing slash */
  function normalizePath(path) {
    if (!path) return '';
    return String(path)
      .replace(/^#\/?/, '')
      .replace(/\.md$/i, '')
      .replace(/^\//, '')
      .replace(/\/$/, '');
  }

  /** Docsify-safe link from site root (hash router, GH Pages project sites) */
  function toHashLink(path) {
    var p = normalizePath(path);
    if (!p || p === 'README') return '#/';
    return '#/' + p;
  }

  /** Collapse /labs/01/labs/01/method → labs/01/method */
  function collapseDoubledLabs(path) {
    var p = String(path || '');
    var prev;
    do {
      prev = p;
      p = p.replace(/(labs\/\d{2}\/)\1+/g, '$1');
    } while (p !== prev);
    return p;
  }

  function labIdFromPath(path) {
    var m = normalizePath(collapseDoubledLabs(path)).match(/^labs\/(\d{2})(?:\/|$)/);
    return m ? m[1] : null;
  }

  function findLab(id) {
    if (!catalog || !catalog.labs) return null;
    for (var i = 0; i < catalog.labs.length; i++) {
      if (catalog.labs[i].id === id) return catalog.labs[i];
    }
    return null;
  }

  function isAccessible(lab) {
    if (!lab || lab.published === false) return false;
    if (lab.unlocked === true) return true;
    if (!lab.unlockCode) return false;
    var unlocks = getUnlocks(catalog.storageKey);
    return !!unlocks[lab.id];
  }

  function buildSidebarMarkdown() {
    var lines = ['- [Главная](#/)', '', '**Лабораторные**', ''];
    (catalog.labs || []).forEach(function (lab) {
      if (lab.published === false) return;
      var open = isAccessible(lab);
      var title = 'ЛР' + lab.number + '. ' + lab.title;
      if (!open) {
        lines.push('- [' + title + ' 🔒](' + toHashLink('labs/' + lab.id + '/') + ')');
        return;
      }
      lines.push('- **' + title + '**');
      (lab.sidebar || []).forEach(function (item) {
        lines.push('  - [' + item.label + '](' + toHashLink(item.path) + ')');
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  function renderGate(lab) {
    return (
      '<div class="labs-gate">' +
      '<h2>ЛР' + lab.number + ' пока закрыта</h2>' +
      '<p class="hint">Материалы откроются, когда преподаватель добавит их в каталог ' +
      'или сообщит код на паре.</p>' +
      (lab.unlockCode
        ? '<label for="lab-code">Код доступа</label>' +
          '<input id="lab-code" type="text" autocomplete="off" placeholder="код с занятия">' +
          '<button type="button" id="lab-unlock-btn">Открыть</button>' +
          '<p class="error" id="lab-unlock-error" hidden>Неверный код.</p>'
        : '<p class="hint">Кода для этой работы нет — ждите появления материалов в каталоге.</p>') +
      '</div>'
    );
  }

  function wireGate(lab) {
    var btn = document.getElementById('lab-unlock-btn');
    var input = document.getElementById('lab-code');
    var err = document.getElementById('lab-unlock-error');
    if (!btn || !input) return;
    function tryUnlock() {
      var value = (input.value || '').trim();
      if (value === String(lab.unlockCode).trim()) {
        setUnlock(catalog.storageKey, lab.id);
        if (err) err.hidden = true;
        location.hash = '#/labs/' + lab.id + '/';
        location.reload();
      } else if (err) {
        err.hidden = false;
      }
    }
    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryUnlock();
    });
  }

  function fixSidebarHrefs() {
    var sidebar = document.querySelector('.sidebar-nav');
    if (!sidebar) return;
    sidebar.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('labs/') === -1) return;

      var hashIdx = href.indexOf('#');
      var hashPart = hashIdx >= 0 ? href.slice(hashIdx + 1) : href;
      hashPart = hashPart.replace(/^\//, '');
      var collapsed = collapseDoubledLabs(hashPart.replace(/^\//, ''));
      var fixed = toHashLink(collapsed);
      if (a.getAttribute('href') !== fixed) {
        a.setAttribute('href', fixed);
      }

      var labId = labIdFromPath(collapsed);
      if (!labId || !catalog) return;
      var item = findLab(labId);
      if (item && !isAccessible(item)) {
        a.parentElement && a.parentElement.classList.add('lab-locked');
      }
    });
  }

  function installPlugin() {
    if (!window.$docsify) window.$docsify = {};
    if (!window.$docsify.plugins) window.$docsify.plugins = [];

    window.$docsify.plugins.push(function (hook, vm) {
      hook.init(function () {
        loadCatalog().catch(function (e) {
          console.error(e);
        });
      });

      hook.beforeEach(function (content, next) {
        loadCatalog()
          .then(function () {
            var raw = normalizePath(vm.route.path || '');
            var clean = normalizePath(collapseDoubledLabs(raw));
            if (raw && clean && raw !== clean) {
              window.location.replace(
                window.location.pathname + window.location.search + '#/' + clean
              );
              next(content);
              return;
            }
            var path = clean;
            var id = labIdFromPath(path);
            if (!id) {
              next(content);
              return;
            }
            var lab = findLab(id);
            if (!lab || lab.published === false) {
              next(
                '# Материал ещё не опубликован\n\n' +
                  'Эта лабораторная пока не добавлена в каталог. ' +
                  'Вернитесь на [главную](#/) и откройте доступные работы.\n'
              );
              return;
            }
            if (!isAccessible(lab)) {
              next(renderGate(lab));
              return;
            }
            next(content);
          })
          .catch(function () {
            next(content);
          });
      });

      hook.doneEach(function () {
        if (!catalog) return;
        var path = normalizePath(collapseDoubledLabs(vm.route.path || ''));
        var id = labIdFromPath(path);
        var lab = id ? findLab(id) : null;
        if (lab && !isAccessible(lab) && lab.unlockCode) {
          wireGate(lab);
        }
        fixSidebarHrefs();
      });
    });
  }

  installPlugin();

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (/_sidebar\.md(\?|$)/.test(url)) {
      return loadCatalog().then(function () {
        return new Response(buildSidebarMarkdown(), {
          status: 200,
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
        });
      });
    }
    return origFetch.apply(this, arguments);
  };
})();

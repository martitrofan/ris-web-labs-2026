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

  function normalizePath(path) {
    if (!path) return '';
    return String(path).replace(/^#\/?/, '').replace(/\.md$/i, '').replace(/\/$/, '');
  }

  function labIdFromPath(path) {
    var m = normalizePath(path).match(/^labs\/(\d{2})(?:\/|$)/);
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
    var lines = ['- [Главная](/)', '', '**Лабораторные**', ''];
    (catalog.labs || []).forEach(function (lab) {
      if (lab.published === false) return;
      var open = isAccessible(lab);
      var title = 'ЛР' + lab.number + '. ' + lab.title;
      if (!open) {
        lines.push('- [' + title + ' 🔒](labs/' + lab.id + '/)');
        return;
      }
      lines.push('- **' + title + '**');
      (lab.sidebar || []).forEach(function (item) {
        lines.push('  - [' + item.label + '](' + item.path + ')');
      });
      lines.push('');
    });
    lines.push('', '- [Как добавить доступ](guide)');
    return lines.join('\n');
  }

  function renderGate(lab, path) {
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
            var path = normalizePath(vm.route.path || '');
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
                  'Вернитесь на [главную](/) и откройте доступные работы.\n'
              );
              return;
            }
            if (!isAccessible(lab)) {
              next(renderGate(lab, path));
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
        var path = normalizePath(vm.route.path || '');
        var id = labIdFromPath(path);
        var lab = id ? findLab(id) : null;
        if (lab && !isAccessible(lab) && lab.unlockCode) {
          wireGate(lab);
        }

        var sidebar = document.querySelector('.sidebar-nav');
        if (!sidebar) return;
        sidebar.querySelectorAll('a').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          var labId = labIdFromPath(href.replace(/^#\//, ''));
          if (!labId) return;
          var item = findLab(labId);
          if (item && !isAccessible(item)) {
            a.parentElement && a.parentElement.classList.add('lab-locked');
          }
        });
      });
    });

    // Replace static sidebar with catalog-driven one after load
    window.$docsify.plugins.push(function (hook) {
      hook.ready(function () {
        loadCatalog().then(function () {
          var el = document.getElementById('labs-sidebar-source');
          if (el) el.textContent = buildSidebarMarkdown();
        });
      });
    });
  }

  // Provide dynamic sidebar file via fetch override is hard;
  // use _sidebar.md that Docsify loads, and also rewrite after catalog load.
  window.$docsify = window.$docsify || {};
  var prevExt = window.$docsify.ext || [];
  if (!Array.isArray(prevExt)) prevExt = [prevExt];

  installPlugin();

  // Patch Docsify request for _sidebar.md to inject dynamic menu
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

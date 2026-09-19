(function () {
  'use strict';

  var catalog = null;
  var catalogPromise = null;
  var COLLAPSE_KEY = 'ris-web-labs-2026-sidebar-open';

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

  function getOpenLabs() {
    try {
      return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function setLabOpen(labId, open) {
    var map = getOpenLabs();
    if (open) map[labId] = true;
    else delete map[labId];
    sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
  }

  function normalizePath(path) {
    if (!path) return '';
    return String(path)
      .replace(/^#\/?/, '')
      .replace(/\.md$/i, '')
      .replace(/^\//, '')
      .replace(/\/index$/i, '')
      .replace(/\/$/, '');
  }

  /** labs/01 и labs/01/ → labs/01/README (иначе Docsify ищет labs/01.md → 404) */
  function canonicalizePath(path) {
    var p = normalizePath(collapseDoubledLabs(path));
    if (/^labs\/\d{2}$/.test(p)) return p + '/README';
    if (/^labs\/\d{2}\/README$/i.test(p)) return p.replace(/README$/i, 'README');
    return p;
  }

  function collapseDoubledLabs(path) {
    var p = String(path || '');
    var prev;
    do {
      prev = p;
      p = p.replace(/(labs\/\d{2}\/)\1+/g, '$1');
    } while (p !== prev);
    return p;
  }

  function currentRoutePath() {
    var hash = window.location.hash || '#/';
    return canonicalizePath(hash.replace(/^#\/?/, ''));
  }

  function routeEquals(a, b) {
    return canonicalizePath(a) === canonicalizePath(b);
  }

  function labOverviewPath(labId) {
    return 'labs/' + labId + '/README';
  }

  function isOverviewSidebarItem(lab, item) {
    var path = canonicalizePath(item && item.path);
    if (!path || !lab) return false;
    if (routeEquals(path, labOverviewPath(lab.id))) return true;
    if (/^labs\/\d{2}$/.test(path) && path === 'labs/' + lab.id) return true;
    return false;
  }

  function labIdFromPath(path) {
    var m = canonicalizePath(path).match(/^labs\/(\d{2})(?:\/|$)/);
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
    return !!getUnlocks(catalog.storageKey)[lab.id];
  }

  function navigate(path) {
    var clean = canonicalizePath(path);
    var next = clean ? '#/' + clean : '#/';
    if (window.location.hash === next) return;
    window.location.hash = next;
  }

  function redirectBareLabIndex() {
    var hash = window.location.hash || '';
    var m = hash.match(/^#\/?(labs\/\d{2})\/?$/);
    if (!m) return false;
    var target = '#/' + m[1] + '/README';
    if (hash === target || hash === '#/' + m[1] + '/README.md') return false;
    window.location.replace(
      window.location.pathname + window.location.search + target
    );
    return true;
  }

  redirectBareLabIndex();
  window.addEventListener('hashchange', function () {
    redirectBareLabIndex();
  });

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
        navigate(labOverviewPath(lab.id));
        window.location.reload();
      } else if (err) {
        err.hidden = false;
      }
    }
    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryUnlock();
    });
  }

  function ensureSidebarRoot() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return null;
    var nav = sidebar.querySelector('.sidebar-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'sidebar-nav';
      sidebar.appendChild(nav);
    }
    return nav;
  }

  function buildCustomSidebarHtml(activePath) {
    var openMap = getOpenLabs();
    var activeLab = labIdFromPath(activePath);
    var html = '';

    html += '<ul class="labs-menu">';
    html +=
      '<li class="labs-menu-home' +
      (!activePath ? ' active' : '') +
      '"><a href="#/" data-lab-nav="home">Главная</a></li>';
    html +=
      '<li class="labs-menu-home' +
      (routeEquals(activePath, 'students') ? ' active' : '') +
      '"><a href="#/students" data-lab-nav="students">Статус проверки</a></li>';

    (catalog.labs || []).forEach(function (lab) {
      if (lab.published === false) return;
      var open = isAccessible(lab);
      var title = 'ЛР' + lab.number + '. ' + lab.title;
      var isCurrent = activeLab === lab.id;
      var expanded = isCurrent || !!openMap[lab.id];

      if (!open) {
        html +=
          '<li class="labs-menu-locked">' +
          '<span class="labs-menu-locked-title">' +
          title +
          ' 🔒</span></li>';
        return;
      }

      html +=
        '<li class="labs-menu-lab' +
        (isCurrent ? ' is-current' : '') +
        '">' +
        '<details class="labs-menu-details" data-lab-id="' +
        lab.id +
        '"' +
        (expanded ? ' open' : '') +
        '>' +
        '<summary class="labs-menu-summary' +
        (routeEquals(labOverviewPath(lab.id), activePath) ? ' is-overview' : '') +
        '" data-lab-overview="' +
        lab.id +
        '" title="Открыть обзор ЛР' +
        lab.number +
        '">' +
        title +
        '</summary>' +
        '<ul class="labs-menu-pages">';

      (lab.sidebar || []).forEach(function (item) {
        if (isOverviewSidebarItem(lab, item)) return;
        var path = canonicalizePath(item.path);
        var active = routeEquals(path, activePath);
        html +=
          '<li' +
          (active ? ' class="active"' : '') +
          '><a href="#/' +
          path +
          '">' +
          item.label +
          '</a></li>';
      });

      html += '</ul></details></li>';
    });

    html += '</ul>';
    return html;
  }

  function wireCustomSidebar(nav) {
    if (!nav || nav.dataset.labsWired === '1') return;
    nav.dataset.labsWired = '1';

    // Не перехватываем клики по ссылкам страниц: нативный #/… обновляет Docsify.
    // Клик по заголовку ЛР → раскрыть + показать обзор (README).

    nav.addEventListener(
      'click',
      function (e) {
        var summary = e.target.closest
          ? e.target.closest('summary.labs-menu-summary')
          : null;
        if (!summary || !nav.contains(summary)) return;
        var details = summary.closest
          ? summary.closest('details.labs-menu-details')
          : summary.parentElement;
        if (!details) return;
        var labId = details.getAttribute('data-lab-id');
        if (!labId) return;

        var overview = labOverviewPath(labId);
        var onOverview = routeEquals(overview, currentRoutePath());

        // Уже на обзоре и блок открыт — даём свернуть нативным toggle.
        if (details.open && onOverview) {
          return;
        }

        e.preventDefault();
        details.open = true;
        setLabOpen(labId, true);
        navigate(overview);
      },
      true
    );

    nav.addEventListener(
      'toggle',
      function (e) {
        var details = e.target;
        if (!details.classList || !details.classList.contains('labs-menu-details'))
          return;
        var labId = details.getAttribute('data-lab-id');
        if (labId) setLabOpen(labId, details.open);
      },
      true
    );
  }

  function renderCustomSidebar() {
    if (!catalog) return;
    var nav = ensureSidebarRoot();
    if (!nav) return;
    var activePath = currentRoutePath();
    nav.innerHTML = buildCustomSidebarHtml(activePath);
    // re-bind after innerHTML wipe
    nav.dataset.labsWired = '0';
    wireCustomSidebar(nav);
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

      hook.mounted(function () {
        loadCatalog().then(renderCustomSidebar);
      });

      hook.beforeEach(function (content, next) {
        loadCatalog()
          .then(function () {
            var raw = String(vm.route.path || '');
            var bare = normalizePath(collapseDoubledLabs(raw));
            var path = canonicalizePath(raw);

            if (/^labs\/\d{2}$/.test(bare) && path !== bare) {
              window.location.replace(
                window.location.pathname + window.location.search + '#/' + path
              );
              next(content);
              return;
            }

            if (bare && path && bare !== path && bare.indexOf('labs/') === 0) {
              var doubled = collapseDoubledLabs(raw);
              if (normalizePath(doubled) !== normalizePath(raw)) {
                window.location.replace(
                  window.location.pathname +
                    window.location.search +
                    '#/' +
                    canonicalizePath(doubled)
                );
                next(content);
                return;
              }
            }

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
        loadCatalog().then(function () {
          var path = canonicalizePath(vm.route.path || '');
          var id = labIdFromPath(path);
          var lab = id ? findLab(id) : null;
          if (lab && !isAccessible(lab) && lab.unlockCode) {
            wireGate(lab);
          }
          if (id) setLabOpen(id, true);
          renderCustomSidebar();
        });
      });
    });
  }

  installPlugin();
})();

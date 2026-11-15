(function () {
  'use strict';

  var LABS = ['lr1', 'lr2', 'lr3', 'lr4', 'lr5', 'lr6', 'lr7', 'lr8', 'lr9', 'lr10'];
  var DEFAULT_LABS = ['lr7', 'lr8', 'lr9', 'lr10'];
  var SHORT = {
    'принято': 'прин',
    'доработать': 'дораб',
    'не сдано': 'нет',
    'недоступен': 'N/A',
    'не актуален': 'стар'
  };
  var CLS = {
    'принято': 'ok',
    'доработать': 'fix',
    'не сдано': 'miss',
    'недоступен': 'down',
    'не актуален': 'old'
  };
  var STATUS_FILTERS = ['принято', 'доработать', 'не сдано', 'недоступен'];
  var STATUS_ORDER = ['принято', 'доработать', 'не сдано', 'недоступен'];

  function normStatus(st) {
    if (st === 'нет в таблице') return 'недоступен';
    return st || 'не сдано';
  }

  var state = {
    data: null,
    fio: '',
    group: '',
    statuses: [],
    visibleLabs: null,
    defaultLabs: null
  };

  function groupsOf(students) {
    var map = {};
    students.forEach(function (s) {
      if (s.group) map[s.group] = true;
    });
    return Object.keys(map).sort();
  }

  function filteredRows() {
    var q = state.fio.trim().toLowerCase();
    var want = state.statuses || [];
    var scope = state.visibleLabs && state.visibleLabs.length ? state.visibleLabs : LABS;
    return state.data.students.filter(function (s) {
      if (state.group && s.group !== state.group) return false;
      if (q && s.fio.toLowerCase().indexOf(q) === -1) return false;
      if (want.length) {
        var hit = scope.some(function (lab) {
          return want.indexOf(normStatus((s.labs || {})[lab])) !== -1;
        });
        if (!hit) return false;
      }
      return true;
    });
  }

  function chip(status) {
    status = normStatus(status);
    var short = SHORT[status] || status;
    var cls = CLS[status] || 'miss';
    return (
      '<span class="sb-chip sb-' + cls + '" title="' + escapeAttr(status) + '">' +
      escapeHtml(short) +
      '</span>'
    );
  }

  function countBits(students, lab) {
    var counts = {};
    STATUS_ORDER.forEach(function (st) {
      counts[st] = 0;
    });
    students.forEach(function (s) {
      var st = normStatus((s.labs || {})[lab]);
      if (counts[st] == null) counts[st] = 0;
      counts[st] += 1;
    });
    return STATUS_ORDER.filter(function (st) {
      return counts[st] > 0;
    })
      .map(function (st) {
        return escapeHtml(st) + ' <strong>' + counts[st] + '</strong>';
      })
      .join(' · ');
  }

  function labListHtml(students, labels) {
    return (
      '<ul class="sb-summary-list">' +
      LABS.map(function (lab) {
        return (
          '<li><strong>' +
          escapeHtml(labels[lab] || lab) +
          ':</strong> ' +
          countBits(students, lab) +
          '</li>'
        );
      }).join('') +
      '</ul>'
    );
  }

  function reviewSummaryHtml(students, labels) {
    var groups = groupsOf(students);
    var byGroup = groups
      .map(function (g) {
        var subset = students.filter(function (s) {
          return s.group === g;
        });
        return (
          '<details class="sb-summary-group">' +
          '<summary class="sb-summary-group-toggle">' +
          escapeHtml(g) +
          ' · ' +
          subset.length +
          '</summary>' +
          labListHtml(subset, labels) +
          '</details>'
        );
      })
      .join('');

    return (
      '<details class="sb-summary">' +
      '<summary class="sb-summary-toggle">Сводка ревью · ' +
      students.length +
      ' студентов</summary>' +
      '<div class="sb-summary-body">' +
      '<div class="sb-summary-block">' +
      '<div class="sb-summary-subtitle">Все группы</div>' +
      labListHtml(students, labels) +
      '</div>' +
      '<div class="sb-summary-block">' +
      '<div class="sb-summary-subtitle">По группам</div>' +
      byGroup +
      '</div>' +
      '</div></details>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function render() {
    var root = document.getElementById('students-board');
    if (!root || !state.data) return;

    var rows = filteredRows();
    var labs = state.visibleLabs || state.defaultLabs || [];
    var labels = state.data.labLabels || {};
    var all = state.data.students.length;

    var groupOpts = ['<option value="">Все группы</option>']
      .concat(
        groupsOf(state.data.students).map(function (g) {
          return (
            '<option value="' +
            escapeAttr(g) +
            '"' +
            (state.group === g ? ' selected' : '') +
            '>' +
            escapeHtml(g) +
            '</option>'
          );
        })
      )
      .join('');

    var labChecks = LABS.map(function (lab) {
      var on = labs.indexOf(lab) !== -1;
      return (
        '<label class="sb-labcheck">' +
        '<input type="checkbox" data-lab="' +
        lab +
        '"' +
        (on ? ' checked' : '') +
        '> ' +
        escapeHtml(labels[lab] || lab) +
        '</label>'
      );
    }).join('');

    var statusChecks = STATUS_FILTERS.map(function (st) {
      var on = (state.statuses || []).indexOf(st) !== -1;
      return (
        '<label class="sb-labcheck">' +
        '<input type="checkbox" data-status="' +
        escapeAttr(st) +
        '"' +
        (on ? ' checked' : '') +
        '> ' +
        chip(st) +
        ' ' +
        escapeHtml(st) +
        '</label>'
      );
    }).join('');

    var headLabs = labs
      .map(function (lab) {
        return '<th class="sb-lab">' + escapeHtml(labels[lab] || lab) + '</th>';
      })
      .join('');

    var body = rows
      .map(function (s) {
        var cells = labs
          .map(function (lab) {
            return '<td class="sb-lab">' + chip(normStatus((s.labs || {})[lab])) + '</td>';
          })
          .join('');
        var name = s.url
          ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.fio) + '</a>'
          : escapeHtml(s.fio);
        return (
          '<tr><td class="sb-fio">' +
          name +
          '</td><td class="sb-group">' +
          escapeHtml(s.group) +
          '</td>' +
          cells +
          '</tr>'
        );
      })
      .join('');

    root.innerHTML =
      '<div class="sb-head">' +
      '<p class="sb-meta">' +
      escapeHtml(state.data.course || '') +
      '</p>' +
      '<p class="sb-date">Ревью ЛР1–ЛР10: <strong>' +
      escapeHtml(state.data.reviewDate || '') +
      '</strong></p>' +
      reviewSummaryHtml(state.data.students || [], labels) +
      '<p class="sb-legend">Статусы: <span class="sb-chip sb-ok" title="принято">прин</span> принято · ' +
      '<span class="sb-chip sb-fix" title="доработать">дораб</span> доработать · ' +
      '<span class="sb-chip sb-miss" title="не сдано">нет</span> не сдано · ' +
      '<span class="sb-chip sb-down" title="недоступен">N/A</span> недоступен</p>' +
      '<p class="sb-count">Показано <strong>' +
      rows.length +
      '</strong> из <strong>' +
      all +
      '</strong></p>' +
      '</div>' +
      '<div class="sb-filters">' +
      '<label class="sb-field">ФИО <input type="search" id="sb-fio" value="' +
      escapeAttr(state.fio) +
      '" placeholder="поиск…"></label>' +
      '<label class="sb-field">Группа <select id="sb-group">' +
      groupOpts +
      '</select></label>' +
      '<div class="sb-labs">' +
      '<div class="sb-labs-title">Статус ЛР <span class="sb-hint">(по видимым колонкам; пусто = все)</span></div>' +
      '<div class="sb-labs-row">' +
      statusChecks +
      '</div></div>' +
      '<div class="sb-labs">' +
      '<div class="sb-labs-title">Колонки ЛР</div>' +
      '<div class="sb-labs-row">' +
      labChecks +
      '</div>' +
      '<div class="sb-labs-actions">' +
      '<button type="button" id="sb-all" class="sb-btn">Все ЛР</button>' +
      '<button type="button" id="sb-reset" class="sb-btn sb-btn-ghost">Сбросить</button>' +
      '</div></div></div>' +
      '<div class="sb-table-wrap"><table class="sb-table">' +
      '<thead><tr><th>ФИО</th><th>Группа</th>' +
      headLabs +
      '</tr></thead><tbody>' +
      (body || '<tr><td colspan="' + (2 + labs.length) + '">Нет строк по фильтру</td></tr>') +
      '</tbody></table></div>';

    bind(root);
  }

  function bind(root) {
    var fio = root.querySelector('#sb-fio');
    var group = root.querySelector('#sb-group');
    if (fio) {
      fio.addEventListener('input', function () {
        state.fio = fio.value;
        render();
        var el = document.getElementById('sb-fio');
        if (el) {
          el.focus();
          var v = el.value;
          el.setSelectionRange(v.length, v.length);
        }
      });
    }
    if (group) {
      group.addEventListener('change', function () {
        state.group = group.value;
        render();
      });
    }
    root.querySelectorAll('input[data-lab]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var next = [];
        root.querySelectorAll('input[data-lab]').forEach(function (x) {
          if (x.checked) next.push(x.getAttribute('data-lab'));
        });
        state.visibleLabs = next;
        render();
      });
    });
    root.querySelectorAll('input[data-status]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var next = [];
        root.querySelectorAll('input[data-status]').forEach(function (x) {
          if (x.checked) next.push(x.getAttribute('data-status'));
        });
        state.statuses = next;
        render();
      });
    });
    var allBtn = root.querySelector('#sb-all');
    var resetBtn = root.querySelector('#sb-reset');
    if (allBtn) {
      allBtn.addEventListener('click', function () {
        state.visibleLabs = LABS.slice();
        render();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state.visibleLabs = state.defaultLabs.slice();
        state.fio = '';
        state.group = '';
        state.statuses = [];
        render();
      });
    }
  }

  function mount() {
    var root = document.getElementById('students-board');
    if (!root) return;
    if (state.data) {
      render();
      return;
    }
    root.innerHTML = '<p class="sb-loading">Загрузка статусов…</p>';
    fetch('students.json?v=40', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('students.json ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        state.defaultLabs = DEFAULT_LABS.slice();
        state.visibleLabs = state.defaultLabs.slice();
        render();
      })
      .catch(function (err) {
        root.innerHTML = '<p class="sb-error">Не удалось загрузить students.json: ' + escapeHtml(err.message) + '</p>';
      });
  }

  function isStudentsRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return h === 'students' || h.indexOf('students') === 0;
  }

  function install() {
    if (!window.$docsify) window.$docsify = {};
    var plugins = window.$docsify.plugins || [];
    plugins.push(function (hook) {
      hook.doneEach(function () {
        if (isStudentsRoute()) mount();
      });
    });
    window.$docsify.plugins = plugins;
  }

  install();
})();

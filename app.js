// ─── State ─────────────────────────────────────────────────
const state = {
  view:            'today',
  activeProjectId: null,
  activeAreaId:    null,    // area view
};

// ─── Ring constants ────────────────────────────────────────
const CIRC_HEADER  = 47.12;   // r=7.5
const CIRC_SIDEBAR = 34.56;   // r=5.5

function ringOffset(circ, ratio) {
  return +(circ - circ * Math.max(0, Math.min(1, ratio))).toFixed(2);
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════

let draggedProjectId = null;

function renderSidebar() {
  const el = document.getElementById('areaList');
  el.innerHTML = '';

  AREAS.forEach(area => {
    const projects = PROJECTS.filter(p => p.areaId === area.id);
    const block = document.createElement('div');
    block.className = 'area-block';

    // ── Area header (clickable + drop target) ──
    const hdr = document.createElement('div');
    hdr.className = 'area-header' + (state.activeAreaId === area.id ? ' active' : '');
    hdr.dataset.areaId = area.id;

    let sharedHTML = '';
    if (area.isShared) {
      const avs = area.collaborators.map(cid => {
        const c = COLLABORATORS[cid];
        return `<div class="mini-av" style="background:${c.color}" title="${c.name}">${c.initials}</div>`;
      }).join('');
      sharedHTML = `<span class="shared-pip">Shared</span><div class="collab-stack">${avs}</div>`;
    }
    hdr.innerHTML = `
      <div class="nav-icon" style="width:20px;height:20px">
        <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
          <circle cx="10" cy="10" r="7" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="3 2.5"/>
        </svg>
      </div>
      <span class="area-label">${area.name}</span>
      ${sharedHTML}
    `;
    hdr.style.cursor = 'pointer';
    hdr.addEventListener('click', () => activateArea(area.id));
    hdr.addEventListener('dblclick', e => { e.stopPropagation(); activateArea(area.id); startInlineEdit(area.id, 'area'); });

    // Drag-over → move project to this area
    hdr.addEventListener('dragover', e => { e.preventDefault(); hdr.style.background = 'var(--blue-bg)'; });
    hdr.addEventListener('dragleave', () => { hdr.style.background = ''; });
    hdr.addEventListener('drop', e => {
      e.preventDefault();
      hdr.style.background = '';
      if (!draggedProjectId) return;
      const p = getProject(draggedProjectId);
      if (p) { p.areaId = area.id; renderSidebar(); }
    });

    // Drop zone above area header
    const dropZoneTop = document.createElement('div');
    dropZoneTop.className = 'area-drop-zone';
    wireDropZone(dropZoneTop, area.id, null);

    block.appendChild(dropZoneTop);
    block.appendChild(hdr);

    // ── Project rows ──
    const list = document.createElement('div');
    list.className = 'proj-list';

    projects.forEach(proj => {
      const { done, total, ratio } = projectProgress(proj.id);
      const isActive = state.activeProjectId === proj.id;
      const offset   = ringOffset(CIRC_SIDEBAR, ratio);

      const fillArc = total > 0
        ? `<circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="var(--ring-fill)" stroke-width="2"
             stroke-dasharray="${CIRC_SIDEBAR}" stroke-dashoffset="${offset}"
             stroke-linecap="round" transform="rotate(-90 7.5 7.5)"/>`
        : '';

      const collabs = proj.collaborators.map(cid => {
        const c = COLLABORATORS[cid];
        return `<div class="mini-av" style="background:${c.color}" title="${c.name}">${c.initials}</div>`;
      }).join('');

      const row = document.createElement('div');
      row.className = 'proj-row' + (isActive ? ' active' : '');
      row.id = 'proj-' + proj.id;
      row.draggable = true;
      row.innerHTML = `
        <svg class="proj-ring" width="15" height="15" viewBox="0 0 15 15">
          <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="var(--ring-track)" stroke-width="2"/>
          ${fillArc}
        </svg>
        <span class="proj-name">${proj.name}</span>
        ${collabs ? `<div class="collab-stack">${collabs}</div>` : ''}
      `;

      row.addEventListener('click', e => { e.stopPropagation(); activateProject(proj.id); });
      row.addEventListener('dblclick', e => { e.stopPropagation(); activateProject(proj.id); startInlineEdit(proj.id, 'project'); });

      // ── Drag source ──
      row.addEventListener('dragstart', e => {
        draggedProjectId = proj.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', proj.id);
        setTimeout(() => row.classList.add('dragging'), 0);
      });
      row.addEventListener('dragend', () => {
        draggedProjectId = null;
        row.classList.remove('dragging');
        document.querySelectorAll('.proj-row.drag-over, .area-drop-zone.drag-over')
          .forEach(r => r.classList.remove('drag-over'));
      });

      // ── Drop target: insert before ──
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (draggedProjectId && draggedProjectId !== proj.id) row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (!draggedProjectId || draggedProjectId === proj.id) return;
        const dragged = getProject(draggedProjectId);
        if (!dragged) return;
        dragged.areaId = area.id;
        DB.updateProject(dragged.id, { areaId: area.id });
        const fromIdx = PROJECTS.indexOf(dragged);
        PROJECTS.splice(fromIdx, 1);
        const toIdx = PROJECTS.indexOf(proj);
        PROJECTS.splice(toIdx, 0, dragged);
        renderSidebar();
      });

      list.appendChild(row);

      const dz = document.createElement('div');
      dz.className = 'area-drop-zone';
      wireDropZone(dz, area.id, proj.id);
      list.appendChild(dz);
    });

    block.appendChild(list);
    el.appendChild(block);
  });
}

function wireDropZone(zone, areaId, afterProjId) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (!draggedProjectId) return;
    const dragged = getProject(draggedProjectId);
    if (!dragged) return;
    if (dragged.areaId !== areaId) {
      dragged.areaId = areaId;
      DB.updateProject(dragged.id, { areaId });
    }
    PROJECTS.splice(PROJECTS.indexOf(dragged), 1);
    if (afterProjId) {
      const anchor = PROJECTS.findIndex(p => p.id === afterProjId);
      PROJECTS.splice(anchor + 1, 0, dragged);
    } else {
      const first = PROJECTS.findIndex(p => p.areaId === areaId);
      PROJECTS.splice(first === -1 ? 0 : first, 0, dragged);
    }
    renderSidebar();
  });
}

// ═══════════════════════════════════════════════════════════
// ACTIVATE: VIEW / AREA / PROJECT
// ═══════════════════════════════════════════════════════════

function activateView(viewName) {
  state.view = viewName;
  state.activeProjectId = null;
  state.activeAreaId    = null;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.proj-row').forEach(r => r.classList.remove('active'));
  const navEl = document.getElementById('nav-' + viewName);
  if (navEl) navEl.classList.add('active');

  const titles = { inbox:'Inbox', today:'Today', upcoming:'Upcoming', anytime:'Anytime', someday:'Someday', logbook:'Logbook', trash:'Trash' };
  const titleEl = document.getElementById('titleText');
  titleEl.textContent = titles[viewName] || viewName;
  titleEl.ondblclick  = null;
  document.getElementById('projSub').textContent       = '';
  document.getElementById('headerRing').style.display  = 'none';
  document.getElementById('headerRight').style.display = 'none';
  document.getElementById('quickAddWrap').style.display =
    ['inbox','today','anytime','someday'].includes(viewName) ? 'block' : 'none';

  renderTaskList();
  renderSidebar();
  updateBadges();
}

function activateArea(areaId) {
  state.view = null;
  state.activeProjectId = null;
  state.activeAreaId    = areaId;

  const area = getArea(areaId);

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.proj-row').forEach(r => r.classList.remove('active'));

  const titleEl = document.getElementById('titleText');
  titleEl.textContent = area.name;
  titleEl.ondblclick  = () => startTitleEdit('area', areaId);
  document.getElementById('projSub').textContent       = `${PROJECTS.filter(p => p.areaId === areaId).length} projects`;
  document.getElementById('headerRing').style.display  = 'none';
  document.getElementById('quickAddWrap').style.display = 'none';

  // Collaborator bar — always show Share button
  const hr = document.getElementById('headerRight');
  document.getElementById('headerAvatars').innerHTML =
    (area.collaborators || []).map(cid => {
      const c = COLLABORATORS[cid];
      return c ? `<div class="av" style="background:${c.color}" title="${c.name}">${c.initials}</div>` : '';
    }).join('');
  hr.style.display = 'flex';

  renderTaskList();
  renderSidebar();
}

function activateProject(projectId) {
  state.view = null;
  state.activeProjectId = projectId;
  state.activeAreaId    = null;

  const proj = getProject(projectId);
  const area = getArea(proj.areaId);
  const { done, total } = projectProgress(projectId);

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.proj-row').forEach(r => r.classList.remove('active'));
  const rowEl = document.getElementById('proj-' + projectId);
  if (rowEl) rowEl.classList.add('active');

  const titleEl = document.getElementById('titleText');
  titleEl.textContent = proj.name;
  titleEl.ondblclick  = () => startTitleEdit('project', projectId);
  document.getElementById('projSub').textContent       = `${area.name} · ${done} of ${total} completed`;
  document.getElementById('headerRing').style.display  = 'block';
  updateHeaderRing(projectId);

  // Collaborator bar — always show Share button
  const hr      = document.getElementById('headerRight');
  const collabs = (proj.collaborators || []).length ? proj.collaborators : area.isShared ? (area.collaborators || []) : [];
  document.getElementById('headerAvatars').innerHTML =
    collabs.map(cid => {
      const c = COLLABORATORS[cid];
      return c ? `<div class="av" style="background:${c.color}" title="${c.name}">${c.initials}</div>` : '';
    }).join('');
  hr.style.display = 'flex';

  document.getElementById('quickAddWrap').style.display = 'block';
  renderTaskList();
  renderSidebar();
}

// ═══════════════════════════════════════════════════════════
// TASK LIST
// ═══════════════════════════════════════════════════════════

function renderTaskList() {
  const el = document.getElementById('taskList');
  el.innerHTML = '';

  if (state.activeProjectId) {
    renderProjectTasks(el);
  } else if (state.activeAreaId) {
    renderAreaView(el);
  } else {
    renderViewTasks(el);
  }
}

// ── Area view: project cards ────────────────────────────────
function renderAreaView(el) {
  const projects = PROJECTS.filter(p => p.areaId === state.activeAreaId);
  if (!projects.length) {
    el.innerHTML = emptyHTML('No projects yet — create one with + New List');
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'area-proj-grid';

  projects.forEach(proj => {
    const { done, total, ratio } = projectProgress(proj.id);
    const r = 18, circ = 2 * Math.PI * r;
    const offset = +(circ - circ * ratio).toFixed(2);

    const todayCount = TASKS.filter(t => t.projectId === proj.id && t.bucket === 'today' && t.status === 'open').length;
    const upcomingCount = TASKS.filter(t => t.projectId === proj.id && t.bucket === 'upcoming' && t.status === 'open').length;

    let metaParts = [`${done} of ${total} completed`];
    if (todayCount)    metaParts.push(`${todayCount} today`);
    if (upcomingCount) metaParts.push(`${upcomingCount} upcoming`);

    const fillArc = total > 0
      ? `<circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--ring-fill)" stroke-width="3"
           stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset}"
           stroke-linecap="round" transform="rotate(-90 22 22)"/>`
      : '';

    const collabs = proj.collaborators.map(cid => {
      const c = COLLABORATORS[cid];
      return `<div class="area-proj-av" style="background:${c.color}" title="${c.name}">${c.initials}</div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'area-proj-card';
    card.innerHTML = `
      <svg class="area-proj-ring" width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="3"/>
        ${fillArc}
      </svg>
      <div class="area-proj-body">
        <div class="area-proj-name">${proj.name}</div>
        <div class="area-proj-meta">${metaParts.join(' · ')}</div>
      </div>
      <div class="area-proj-right">
        ${collabs ? `<div class="area-proj-av-stack">${collabs}</div>` : ''}
        <span class="area-proj-chevron">›</span>
      </div>
    `;
    card.addEventListener('click', () => activateProject(proj.id));
    grid.appendChild(card);
  });

  el.appendChild(grid);
}

// ── Project task list with headings ────────────────────────
function renderProjectTasks(el) {
  const projectId = state.activeProjectId;
  const allTasks  = projectTasks(projectId).filter(t => t.status !== 'trash');
  const headings  = getHeadingsForProject(projectId);

  if (!allTasks.length && !headings.length) {
    el.innerHTML = emptyHTML('No tasks yet');
    appendAddHeadingBtn(el, projectId);
    return;
  }

  // Tasks not assigned to any heading (section = null)
  const unheadedTasks = allTasks.filter(t => !t.section);
  el.appendChild(makeTaskDropZone(null)); // drop zone before first task
  unheadedTasks.forEach(t => {
    el.appendChild(makeTaskRow(t));
    el.appendChild(makeTaskDropZone(null));
  });
  if (unheadedTasks.length) el.appendChild(makeGap());

  // Each heading followed by its tasks
  headings.forEach(heading => {
    const hRow = makeHeadingRow(heading, projectId);
    // Make heading a drop target too
    let hEnter = 0;
    hRow.addEventListener('dragenter', e => { e.preventDefault(); hEnter++; hRow.classList.add('heading-drag-over'); });
    hRow.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    hRow.addEventListener('dragleave', () => { hEnter--; if (hEnter <= 0) { hEnter = 0; hRow.classList.remove('heading-drag-over'); } });
    hRow.addEventListener('drop', e => {
      e.preventDefault();
      hEnter = 0;
      hRow.classList.remove('heading-drag-over');
      if (!_dragTaskId) return;
      const task = getTask(_dragTaskId);
      if (!task) return;
      task.section = heading.name;
      DB.updateTask(task.id, { section: task.section });
      renderTaskList();
    });
    el.appendChild(hRow);

    const hTasks = allTasks.filter(t => t.section === heading.name);
    el.appendChild(makeTaskDropZone(heading.name)); // drop zone before first task in heading
    hTasks.forEach(t => {
      el.appendChild(makeTaskRow(t));
      el.appendChild(makeTaskDropZone(heading.name));
    });

    el.appendChild(makeGap());
  });

  appendAddHeadingBtn(el, projectId);
}

function makeHeadingRow(heading, projectId) {
  const wrap = document.createElement('div');
  wrap.className = 'heading-row';

  const nameEl = document.createElement('div');
  nameEl.className = 'heading-name';
  nameEl.contentEditable = 'true';
  nameEl.textContent = heading.name;
  nameEl.setAttribute('placeholder', 'Untitled Heading');

  // Save on blur or Enter
  function saveHeading() {
    const newName = nameEl.textContent.trim();
    if (!newName) { nameEl.textContent = heading.name; return; }
    const oldName = heading.name;
    heading.name = newName;
    // Update tasks that referenced old name
    TASKS.forEach(t => {
      if (t.projectId === projectId && t.section === oldName) {
        t.section = newName;
        DB.updateTask(t.id, { section: newName });
      }
    });
    DB.updateHeading(heading.id, { name: newName });
  }
  nameEl.addEventListener('blur', saveHeading);
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
    if (e.key === 'Escape') { nameEl.textContent = heading.name; nameEl.blur(); }
  });

  // Actions: delete heading
  const actions = document.createElement('div');
  actions.className = 'heading-actions';
  actions.innerHTML = `
    <button class="heading-btn" title="Delete heading">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </button>
  `;
  actions.querySelector('button').addEventListener('click', () => {
    // Remove heading; keep tasks but clear their section
    TASKS.forEach(t => {
      if (t.projectId === projectId && t.section === heading.name) {
        t.section = null;
        DB.updateTask(t.id, { section: null });
      }
    });
    DB.deleteHeading(heading.id);
    HEADINGS.splice(HEADINGS.indexOf(heading), 1);
    renderTaskList();
  });

  wrap.appendChild(nameEl);
  wrap.appendChild(actions);
  return wrap;
}

function appendAddHeadingBtn(el, projectId) {
  const btn = document.createElement('button');
  btn.className = 'btn-add-heading';
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <line x1="6.5" y1="1" x2="6.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="1" y1="6.5" x2="12" y2="6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    New Heading
  `;
  btn.addEventListener('click', () => addHeading(projectId));
  el.appendChild(btn);
}

function addHeading(projectId) {
  const name = `Heading ${HEADINGS.filter(h => h.projectId === projectId).length + 1}`;
  const maxOrder = Math.max(0, ...HEADINGS.filter(h => h.projectId === projectId).map(h => h.order));
  const newHeading = { id: 'h' + nextId(), projectId, name, order: maxOrder + 1 };
  HEADINGS.push(newHeading);
  DB.createHeading(newHeading);
  renderTaskList();
  // Focus the new heading name for immediate editing
  setTimeout(() => {
    const rows = document.querySelectorAll('.heading-name');
    const last = rows[rows.length - 1];
    if (last) {
      last.focus();
      const range = document.createRange();
      range.selectNodeContents(last);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
  }, 40);
}

// ── Standard views ──────────────────────────────────────────
function renderViewTasks(el) {
  const tasks = viewTasks(state.view);
  if (!tasks.length) {
    const msgs = { inbox:'Inbox is empty', today:'Nothing due today', upcoming:'Nothing upcoming', anytime:'No tasks here', someday:'No someday tasks', logbook:'No completed tasks', trash:'Trash is empty' };
    el.innerHTML = emptyHTML(msgs[state.view] || 'No tasks');
    return;
  }
  if (state.view === 'today' || state.view === 'upcoming') {
    groupByProject(el, tasks, 'var(--blue)');
  } else if (state.view === 'logbook') {
    groupByProject(el, tasks, 'var(--check)');
  } else {
    tasks.forEach(t => el.appendChild(makeTaskRow(t)));
  }
}

function groupByProject(el, tasks, dotColor) {
  const byProj = {};
  tasks.forEach(t => { const pid = t.projectId || '_inbox'; (byProj[pid] = byProj[pid] || []).push(t); });
  Object.entries(byProj).forEach(([pid, items]) => {
    const proj = pid === '_inbox' ? null : getProject(pid);
    const grp  = document.createElement('div');
    grp.className = 'task-group-header';
    grp.innerHTML = `<div class="task-group-proj-dot" style="background:${dotColor}"></div>${proj ? proj.name : 'Inbox'}`;
    el.appendChild(grp);
    items.forEach(t => el.appendChild(makeTaskRow(t)));
    el.appendChild(makeGap());
  });
}

function makeGap() { const d = document.createElement('div'); d.className = 'gap'; return d; }
function emptyHTML(msg) { return `<div class="empty-state"><p>${msg}</p></div>`; }

// ─── Task row ──────────────────────────────────────────────
function makeTaskRow(task) {
  const row      = document.createElement('div');
  const isDone   = task.status === 'done';
  const assignee = task.assigneeId ? COLLABORATORS[task.assigneeId] : null;
  row.className      = 'task-row';
  row.dataset.taskId = task.id;
  row.draggable      = true;

  const tags     = task.tags.map(t => `<span class="tag tag-label">${t}</span>`).join('');
  const dateMeta = task.dueLabel === 'Today'
    ? `<span class="tag tag-today">Today</span>`
    : task.dueLabel ? `<span class="tag tag-date">${task.dueLabel}</span>` : '';
  const meta   = (dateMeta || tags) ? `<div class="task-meta">${dateMeta}${tags}</div>` : '';
  const avHTML = assignee
    ? `<div class="task-av" style="background:${assignee.color}" title="${assignee.name}">${assignee.initials}</div>`
    : '';

  row.innerHTML = `
    <div class="task-date-btn" title="Set due date">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="1" y="2" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
        <line x1="4" y1="1" x2="4" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="9" y1="1" x2="9" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="1" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1"/>
        <circle cx="4.5" cy="8" r="1" fill="currentColor"/>
        <circle cx="6.5" cy="8" r="1" fill="currentColor"/>
        <circle cx="8.5" cy="8" r="1" fill="currentColor"/>
      </svg>
      <input type="date" tabindex="-1" title=""/>
    </div>
    <div class="check${isDone ? ' done' : ''}"></div>
    <div class="task-body">
      <div class="task-name${isDone ? ' done' : ''}">${task.name}</div>
      ${meta}
    </div>
    ${avHTML}
  `;

  // Date picker
  const dateInput = row.querySelector('input[type="date"]');
  if (task.dueDate) dateInput.value = task.dueDate;
  dateInput.addEventListener('change', e => {
    e.stopPropagation();
    const val = dateInput.value; // "YYYY-MM-DD"
    task.dueDate = val;
    if (val) {
      const d = new Date(val + 'T00:00:00');
      const today = new Date(); today.setHours(0,0,0,0);
      const diff  = Math.round((d - today) / 86400000);
      if (diff === 0)      task.dueLabel = 'Today';
      else if (diff === 1) task.dueLabel = 'Tomorrow';
      else task.dueLabel = d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    } else {
      task.dueLabel = null;
    }
    DB.updateTask(task.id, { dueDate: task.dueDate, dueLabel: task.dueLabel });
    renderTaskList(); updateBadges();
  });
  dateInput.addEventListener('click', e => e.stopPropagation());

  row.querySelector('.check').addEventListener('click', e => { e.stopPropagation(); toggleTask(task.id); });
  row.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(task.id, e.clientX, e.clientY); });

  // Drag events on the row
  row.addEventListener('dragstart', e => {
    _dragTaskId = task.id;
    row.classList.add('task-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  });
  row.addEventListener('dragend', () => {
    _dragTaskId = null;
    row.classList.remove('task-dragging');
    document.querySelectorAll('.task-drop-zone.drag-over, .heading-row.heading-drag-over')
      .forEach(el => el.classList.remove('drag-over', 'heading-drag-over'));
  });

  return row;
}

// ─── Task drag state ───────────────────────────────────────
let _dragTaskId = null;

function makeTaskDropZone(targetSection) {
  const dz = document.createElement('div');
  dz.className = 'task-drop-zone';
  dz.dataset.section = targetSection ?? '';

  // Use enter/leave counter to avoid false dragleave on child elements
  let enterCount = 0;
  dz.addEventListener('dragenter', e => {
    e.preventDefault();
    enterCount++;
    dz.classList.add('drag-over');
  });
  dz.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  dz.addEventListener('dragleave', () => {
    enterCount--;
    if (enterCount <= 0) { enterCount = 0; dz.classList.remove('drag-over'); }
  });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    enterCount = 0;
    dz.classList.remove('drag-over');
    if (!_dragTaskId) return;
    const task = getTask(_dragTaskId);
    if (!task) return;
    task.section = targetSection ?? null;
    DB.updateTask(task.id, { section: task.section });
    renderTaskList();
  });
  return dz;
}

// ─── Toggle task ───────────────────────────────────────────
function toggleTask(taskId) {
  const task = getTask(taskId);
  if (!task) return;
  task.status = task.status === 'done' ? 'open' : 'done';
  if (task.status === 'done') showToast('Completed  ✓');
  DB.updateTask(task.id, { status: task.status });
  renderTaskList();
  renderSidebar();
  updateHeaderRingForCurrent();
  updateProjSub();
  updateBadges();
}

// ─── Rings ─────────────────────────────────────────────────
function updateHeaderRing(projectId) {
  const fill = document.getElementById('headerRingFill');
  if (fill) fill.setAttribute('stroke-dashoffset', ringOffset(CIRC_HEADER, projectProgress(projectId).ratio));
}
function updateHeaderRingForCurrent() { if (state.activeProjectId) updateHeaderRing(state.activeProjectId); }
function updateProjSub() {
  if (!state.activeProjectId) return;
  const proj = getProject(state.activeProjectId);
  const area = getArea(proj.areaId);
  const { done, total } = projectProgress(state.activeProjectId);
  document.getElementById('projSub').textContent = `${area.name} · ${done} of ${total} completed`;
}

// ─── Badges ────────────────────────────────────────────────
function updateBadges() {
  document.getElementById('badge-inbox').textContent = viewTasks('inbox').length || '';
  document.getElementById('badge-today').textContent = viewTasks('today').length || '';
}

// ═══════════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════════════

let ctxTaskId = null;

function showContextMenu(taskId, x, y) {
  ctxTaskId = taskId;
  const task = getTask(taskId);
  const menu = document.getElementById('ctxMenu');

  document.getElementById('ctx-toggle-label').textContent =
    task.status === 'done' ? 'Mark as Open' : 'Mark as Done';

  document.getElementById('ctx-sub-assign').innerHTML =
    Object.values(COLLABORATORS).map(c => `
      <div class="ctx-item" data-action="assign-to" data-collab="${c.id}">
        <div style="width:16px;height:16px;border-radius:50%;background:${c.color};display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:600;color:#fff;flex-shrink:0">${c.initials}</div>
        ${c.name}${task.assigneeId === c.id ? ' ✓' : ''}
      </div>`).join('');

  document.getElementById('ctx-sub-move').innerHTML =
    PROJECTS.map(p => `
      <div class="ctx-item" data-action="move-to" data-project="${p.id}">
        <svg width="12" height="12" viewBox="0 0 12 12" class="ctx-icon"><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--muted)" stroke-width="1.5"/></svg>
        ${p.name}${task.projectId === p.id ? ' ✓' : ''}
      </div>`).join('');

  menu.style.display = 'block';
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = (x + mw > window.innerWidth  ? x - mw : x) + 'px';
  menu.style.top  = (y + mh > window.innerHeight ? y - mh : y) + 'px';
}

function hideContextMenu() {
  document.getElementById('ctxMenu').style.display = 'none';
  ctxTaskId = null;
}

document.getElementById('ctxMenu').addEventListener('click', e => {
  const item = e.target.closest('[data-action]');
  if (!item || !ctxTaskId) return;
  const task   = getTask(ctxTaskId);
  const action = item.dataset.action;

  if (action === 'when') {
    task.bucket   = item.dataset.bucket;
    task.dueLabel = item.dataset.bucket === 'today' ? 'Today' : null;
    if (task.status === 'done') task.status = 'open';
    DB.updateTask(task.id, { bucket: task.bucket, dueLabel: task.dueLabel, status: task.status });
    showToast(`Moved to ${item.dataset.bucket}`);
    renderTaskList(); renderSidebar(); updateBadges();
  } else if (action === 'due') {
    const d = prompt('Set due date (e.g. May 20):');
    if (d) { task.dueLabel = d.trim(); DB.updateTask(task.id, { dueLabel: task.dueLabel }); renderTaskList(); }
  } else if (action === 'tag') {
    const t = prompt('Add tag:');
    if (t && !task.tags.includes(t.trim())) { task.tags.push(t.trim()); DB.updateTask(task.id, { tags: task.tags }); renderTaskList(); }
  } else if (action === 'assign-to') {
    task.assigneeId = item.dataset.collab;
    DB.updateTask(task.id, { assigneeId: task.assigneeId });
    showToast(`Assigned to ${COLLABORATORS[task.assigneeId].name}`);
    renderTaskList();
  } else if (action === 'move-to') {
    task.projectId = item.dataset.project;
    task.bucket    = 'anytime';
    DB.updateTask(task.id, { projectId: task.projectId, bucket: task.bucket });
    showToast(`Moved to ${getProject(task.projectId).name}`);
    renderTaskList(); renderSidebar();
  } else if (action === 'toggle-done') {
    toggleTask(ctxTaskId);
  } else if (action === 'delete') {
    task.status = 'trash';
    DB.updateTask(task.id, { status: 'trash' });
    showToast('Moved to Trash');
    renderTaskList(); renderSidebar(); updateBadges(); updateProjSub();
  }

  hideContextMenu();
});

document.addEventListener('click', e => {
  if (!document.getElementById('ctxMenu').contains(e.target)) hideContextMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideContextMenu(); closeNlPopover(); } });

// ═══════════════════════════════════════════════════════════
// NEW LIST POPOVER
// ═══════════════════════════════════════════════════════════

function toggleNewListPopover(e) {
  e.stopPropagation();
  const pop = document.getElementById('nlPopover');
  if (pop.style.display !== 'none') { closeNlPopover(); return; }
  const btn  = document.getElementById('btnNewList');
  const rect = btn.getBoundingClientRect();
  pop.style.display = 'block';
  pop.style.left    = rect.left + 'px';
  pop.style.bottom  = (window.innerHeight - rect.top + 6) + 'px';
  pop.style.top     = 'auto';
}

function closeNlPopover() {
  document.getElementById('nlPopover').style.display = 'none';
}

document.getElementById('nl-area').addEventListener('click', () => {
  closeNlPopover();
  const id = 'a' + nextId();
  const newArea = { id, name: 'New Area', isShared: false, collaborators: [] };
  AREAS.push(newArea);
  renderSidebar();
  startInlineEdit(id, 'area');
  // DB.createArea called after commit (in startInlineEdit → commit → renderSidebar)
  // We defer creation until name is confirmed
  newArea._pending = true;
});

document.getElementById('nl-project').addEventListener('click', () => {
  closeNlPopover();
  let areaId = state.activeAreaId
    || (state.activeProjectId ? getProject(state.activeProjectId)?.areaId : null)
    || AREAS[0]?.id;
  if (!areaId) { showToast('Create an area first'); return; }
  const id = 'p' + nextId();
  const newProject = { id, areaId, name: 'New Project', collaborators: [] };
  PROJECTS.push(newProject);
  renderSidebar();
  startInlineEdit(id, 'project');
  newProject._pending = true;
});

// ─── Inline rename for newly created entries ──────────────
function startInlineEdit(id, type) {
  let labelEl, dataObj;

  if (type === 'area') {
    const hdr = document.querySelector(`.area-header[data-area-id="${id}"]`);
    if (!hdr) return;
    labelEl = hdr.querySelector('.area-label');
    dataObj = getArea(id);
    // Activate the area visually
    document.querySelectorAll('.area-header').forEach(h => h.classList.remove('active'));
    hdr.classList.add('active');
  } else {
    const row = document.getElementById('proj-' + id);
    if (!row) return;
    labelEl = row.querySelector('.proj-name');
    dataObj = getProject(id);
    // Activate the project row visually
    document.querySelectorAll('.proj-row').forEach(r => r.classList.remove('active'));
    row.classList.add('active');
  }

  if (!labelEl || !dataObj) return;

  const original = dataObj.name;
  labelEl.contentEditable = 'true';
  labelEl.classList.add('inline-editing');
  labelEl.focus();
  // Select all text so typing replaces the placeholder
  const range = document.createRange();
  range.selectNodeContents(labelEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  function commit() {
    const newName = labelEl.textContent.trim();
    labelEl.contentEditable = 'false';
    labelEl.classList.remove('inline-editing');
    if (!newName) {
      // Empty — remove the entry
      cancel();
      return;
    }
    dataObj.name = newName;
    // Persist to DB
    if (type === 'area') {
      if (dataObj._pending) { delete dataObj._pending; DB.createArea(dataObj); }
      else { DB.updateArea(id, { name: newName }); }
    } else {
      if (dataObj._pending) { delete dataObj._pending; DB.createProject(dataObj); }
      else { DB.updateProject(id, { name: newName }); }
    }
    renderSidebar();
    if (type === 'project') activateProject(id);
    else activateArea(id);
  }

  function cancel() {
    labelEl.contentEditable = 'false';
    labelEl.classList.remove('inline-editing');
    if (type === 'area') {
      const idx = AREAS.findIndex(a => a.id === id);
      if (idx >= 0) { if (!AREAS[idx]._pending) DB.deleteArea(id); AREAS.splice(idx, 1); }
    } else {
      const idx = PROJECTS.findIndex(p => p.id === id);
      if (idx >= 0) { if (!PROJECTS[idx]._pending) DB.deleteProject(id); PROJECTS.splice(idx, 1); }
    }
    renderSidebar();
  }

  let committed = false;
  labelEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      committed = true;
      commit();
    }
    if (e.key === 'Escape') {
      committed = true;
      cancel();
    }
    e.stopPropagation();
  });
  labelEl.addEventListener('blur', () => {
    if (!committed) { committed = true; commit(); }
  });
  labelEl.addEventListener('click', e => e.stopPropagation());
}

document.addEventListener('click', e => {
  const pop = document.getElementById('nlPopover');
  const btn = document.getElementById('btnNewList');
  if (!pop.contains(e.target) && !btn.contains(e.target)) closeNlPopover();
});

// ═══════════════════════════════════════════════════════════
// QUICK-ADD
// ═══════════════════════════════════════════════════════════

function handleQuickAddKey(e) {
  if (e.key !== 'Enter') return;
  const input = document.getElementById('quickAddInput');
  const name  = input.value.trim();
  if (!name) return;
  const newTask = {
    id: nextId(), projectId: state.activeProjectId || null, name,
    status: 'open',
    bucket: state.activeProjectId ? 'anytime' : (state.view === 'today' ? 'today' : state.view || 'inbox'),
    section: null, assigneeId: null, tags: [],
    dueLabel: state.view === 'today' ? 'Today' : null,
  };
  TASKS.push(newTask);
  DB.createTask(newTask);
  input.value = '';
  renderTaskList(); renderSidebar(); updateHeaderRingForCurrent(); updateProjSub(); updateBadges();
  showToast('To-do added');
}

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════

// ─── Avatar button ─────────────────────────────────────────
function updateAvatarBtn() {
  const btn = document.getElementById('btnAvatar');
  if (!btn) return;
  const p = USER_PROFILE;
  if (p.photo) {
    btn.innerHTML = `<img src="${p.photo}" alt="Profile"/>`;
  } else {
    const initials = ((p.firstName||'')[0] + (p.lastName||'')[0]).toUpperCase();
    if (initials.trim()) {
      btn.innerHTML = `<span class="av-initials">${initials}</span>`;
    } else {
      // Default person silhouette
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6.5" r="3" stroke="currentColor" stroke-width="1.4"/>
        <path d="M2.5 16c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`;
    }
  }
}

function openSettings() {
  const p = USER_PROFILE;
  document.getElementById('sf-first').value = p.firstName || '';
  document.getElementById('sf-last').value  = p.lastName  || '';
  document.getElementById('sf-email').value = p.email     || '';

  // Photo preview
  const preview = document.getElementById('settingsPhotoPreview');
  if (p.photo) {
    preview.innerHTML = `<img src="${p.photo}" alt="Profile photo"/>`;
  } else {
    const initials = ((p.firstName||'')[0] + (p.lastName||'')[0]).toUpperCase();
    if (initials.trim()) {
      preview.textContent = initials;
    } else {
      preview.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="6" stroke="var(--muted)" stroke-width="2"/>
        <path d="M4 30c0-6.6 5.4-12 12-12s12 5.4 12 12" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    }
  }

  const sub = p.subscription, used = sub.members.length, total = sub.seats;
  document.getElementById('sub-plan-name').textContent   = sub.plan;
  document.getElementById('sub-seats-label').textContent = `${used} of ${total} seats used`;
  document.getElementById('sub-seats-fill').style.width  = Math.round(used/total*100) + '%';
  document.getElementById('sub-seats-count').textContent = `${total-used} seat${total-used!==1?'s':''} available`;
  document.getElementById('sub-members').innerHTML = sub.members.map(m => {
    const c = COLLABORATORS[m.collabId], isMe = m.collabId === 'AL';
    return `<div class="sub-member-row">
      <div class="sub-member-av" style="background:${c.color}">${c.initials}</div>
      <div class="sub-member-info">
        <div class="sub-member-name">${c.name}${isMe?' (you)':''}</div>
        <div class="sub-member-role">${isMe ? p.email : c.name.toLowerCase().replace(' ','.')+'@team.com'}</div>
      </div>
      <span class="sub-member-badge ${m.role==='owner'?'owner':''}">${m.role==='owner'?'Owner':'Member'}</span>
    </div>`;
  }).join('');

  document.getElementById('settingsModal').style.display = 'flex';
  setTimeout(() => document.getElementById('sf-first').focus(), 80);
}

function closeSettings() { document.getElementById('settingsModal').style.display = 'none'; }
function overlayClose(e) {
  if (e.target === document.getElementById('settingsModal')) closeSettings();
  if (e.target === document.getElementById('shareModal')) closeShare();
}
function saveSettings() {
  USER_PROFILE.firstName = document.getElementById('sf-first').value.trim();
  USER_PROFILE.lastName  = document.getElementById('sf-last').value.trim();
  USER_PROFILE.email     = document.getElementById('sf-email').value.trim();
  DB.updateProfile({ firstName: USER_PROFILE.firstName, lastName: USER_PROFILE.lastName, email: USER_PROFILE.email });
  updateAvatarBtn();
  closeSettings();
  showToast('Settings saved');
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    USER_PROFILE.photo = ev.target.result;
    // Update preview in modal
    const preview = document.getElementById('settingsPhotoPreview');
    preview.textContent = '';
    preview.innerHTML = `<img src="${USER_PROFILE.photo}" alt="Profile photo"/>`;
    // Update sidebar button immediately
    updateAvatarBtn();
    DB.updateProfile({ photo: USER_PROFILE.photo });
  };
  reader.readAsDataURL(file);
}

// ─── Rename title inline (double-click on main header) ─────
function startTitleEdit(type, id) {
  const el  = document.getElementById('titleText');
  const obj = type === 'project' ? getProject(id) : getArea(id);
  if (!obj) return;

  el.contentEditable = 'true';
  el.style.minWidth  = '60px';
  el.style.outline   = 'none';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let committed = false;

  function commit() {
    if (committed) return;
    committed = true;
    const newName = el.textContent.trim();
    el.contentEditable = 'false';
    el.style.minWidth  = '';
    if (!newName) { el.textContent = obj.name; return; }
    obj.name = newName;
    if (type === 'project') {
      DB.updateProject(id, { name: newName });
    } else {
      DB.updateArea(id, { name: newName });
    }
    renderSidebar();
  }

  function revert() {
    if (committed) return;
    committed = true;
    el.contentEditable = 'false';
    el.style.minWidth  = '';
    el.textContent = obj.name;
  }

  el.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); el.removeEventListener('keydown', onKey); }
    if (e.key === 'Escape') { revert(); el.removeEventListener('keydown', onKey); }
    e.stopPropagation();
  });
  el.addEventListener('blur', function onBlur() {
    commit();
    el.removeEventListener('blur', onBlur);
  });
}

// ═══════════════════════════════════════════════════════════
// SHARE MODAL
// ═══════════════════════════════════════════════════════════

let _shareContext = null; // { type: 'project'|'area', id }

function handleShare() {
  // Determine context: active project or area
  if (state.activeProjectId) {
    _shareContext = { type: 'project', id: state.activeProjectId };
  } else if (state.activeAreaId) {
    _shareContext = { type: 'area', id: state.activeAreaId };
  } else {
    _shareContext = null;
  }

  // Build a fake invite link
  const token = Math.random().toString(36).slice(2, 10);
  const linkText = `https://papertray.app/invite/${token}`;
  document.getElementById('shareLinkText').textContent = linkText;
  document.getElementById('shareLinkText').dataset.link = linkText;

  // Title
  let title = 'Share';
  if (_shareContext) {
    const obj = _shareContext.type === 'project'
      ? getProject(_shareContext.id)
      : getArea(_shareContext.id);
    if (obj) title = `Share "${obj.name}"`;
  }
  document.getElementById('shareModalTitle').textContent = title;

  renderShareCollabs();
  renderShareAddList();

  // Reset copy button & email input
  const copyBtn = document.getElementById('btnCopyLink');
  copyBtn.classList.remove('copied');
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="1" width="8" height="9.5" rx="1.5" stroke="currentColor" stroke-width="1.25"/><path d="M2 4.5H1.5A1.5 1.5 0 000 6v6.5A1.5 1.5 0 001.5 14H9a1.5 1.5 0 001.5-1.5V12" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg> Copy link`;
  document.getElementById('inviteEmailInput').value = '';

  document.getElementById('shareModal').style.display = 'flex';
  setTimeout(() => document.getElementById('inviteEmailInput').focus(), 120);
}

function closeShare() {
  document.getElementById('shareModal').style.display = 'none';
  _shareContext = null;
}

function _getShareObj() {
  if (!_shareContext) return null;
  return _shareContext.type === 'project'
    ? getProject(_shareContext.id)
    : getArea(_shareContext.id);
}

function renderShareCollabs() {
  const listEl = document.getElementById('shareCollabsList');
  listEl.innerHTML = '';
  const obj = _getShareObj();
  const currentIds = obj ? (obj.collaborators || []) : [];

  // Owner row (always first)
  const initials = ((USER_PROFILE.firstName||'')[0] + (USER_PROFILE.lastName||'')[0]).toUpperCase();
  const ownerRow = document.createElement('div');
  ownerRow.className = 'share-collab-row';
  ownerRow.innerHTML = `
    <div class="share-collab-av" style="background:var(--blue)">${initials}</div>
    <div class="share-collab-info">
      <div class="share-collab-name">${USER_PROFILE.firstName} ${USER_PROFILE.lastName}</div>
      <div class="share-collab-email">${USER_PROFILE.email}</div>
    </div>
    <span class="share-collab-role owner">Owner</span>`;
  listEl.appendChild(ownerRow);

  // Member rows
  currentIds.forEach(cid => {
    const c = COLLABORATORS[cid];
    if (!c) return;
    const row = document.createElement('div');
    row.className = 'share-collab-row';
    row.innerHTML = `
      <div class="share-collab-av" style="background:${c.color}">${c.initials}</div>
      <div class="share-collab-info">
        <div class="share-collab-name">${c.name}</div>
        <div class="share-collab-email">${c.name.toLowerCase().replace(' ','.')}@team.com</div>
      </div>
      <span class="share-collab-role">Member</span>
      <button class="btn-collab-remove" title="Remove" onclick="removeCollaborator('${cid}')">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>`;
    listEl.appendChild(row);
  });
}

function renderShareAddList() {
  const addEl = document.getElementById('shareAddList');
  addEl.innerHTML = '';
  const obj = _getShareObj();
  const currentIds = new Set(obj ? (obj.collaborators || []) : []);
  const available = Object.values(COLLABORATORS).filter(c => !currentIds.has(c.id));

  if (!available.length) {
    addEl.innerHTML = `<div class="share-add-empty">All team members already have access.</div>`;
    return;
  }

  available.forEach(c => {
    const row = document.createElement('div');
    row.className = 'share-add-row';
    row.innerHTML = `
      <div class="share-collab-av" style="background:${c.color}">${c.initials}</div>
      <div class="share-add-info">
        <div class="share-add-name">${c.name}</div>
        <div class="share-add-role">Team member</div>
      </div>
      <button class="btn-add-collab" onclick="addCollaborator('${c.id}')">Add</button>`;
    addEl.appendChild(row);
  });
}

function addCollaborator(collabId) {
  const obj = _getShareObj();
  if (!obj) return;
  if (!obj.collaborators) obj.collaborators = [];
  if (!obj.collaborators.includes(collabId)) {
    obj.collaborators.push(collabId);
    if (_shareContext.type === 'project') DB.updateProject(obj.id, { collaborators: obj.collaborators });
    else DB.updateArea(obj.id, { collaborators: obj.collaborators });
  }
  renderShareCollabs();
  renderShareAddList();
  renderSidebar();
  showToast(`${COLLABORATORS[collabId].name} added`);
}

function removeCollaborator(collabId) {
  const obj = _getShareObj();
  if (!obj || !obj.collaborators) return;
  obj.collaborators = obj.collaborators.filter(id => id !== collabId);
  if (_shareContext.type === 'project') DB.updateProject(obj.id, { collaborators: obj.collaborators });
  else DB.updateArea(obj.id, { collaborators: obj.collaborators });
  renderShareCollabs();
  renderShareAddList();
  renderSidebar();
  showToast(`${COLLABORATORS[collabId].name} removed`);
}

function copyShareLink() {
  const link = document.getElementById('shareLinkText').dataset.link
             || document.getElementById('shareLinkText').textContent;
  navigator.clipboard.writeText(link).catch(() => {});
  const btn = document.getElementById('btnCopyLink');
  btn.classList.add('copied');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied!`;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="1" width="8" height="9.5" rx="1.5" stroke="currentColor" stroke-width="1.25"/><path d="M2 4.5H1.5A1.5 1.5 0 000 6v6.5A1.5 1.5 0 001.5 14H9a1.5 1.5 0 001.5-1.5V12" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg> Copy link`;
  }, 2000);
}

function handleInviteKey(e) {
  if (e.key === 'Enter') sendInvite();
}

function sendInvite() {
  const input = document.getElementById('inviteEmailInput');
  const email = input.value.trim();
  if (!email || !email.includes('@')) {
    input.style.setProperty('--shake', '1');
    input.closest('.invite-input-wrap').style.borderColor = 'var(--red)';
    setTimeout(() => input.closest('.invite-input-wrap').style.borderColor = '', 900);
    return;
  }
  input.value = '';
  showToast(`Invite sent to ${email}`);
}

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════

let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// SIDEBAR RESIZE HANDLE
// ═══════════════════════════════════════════════════════════

(function initResizeHandle() {
  const handle   = document.getElementById('sbResizeHandle');
  const sidebar  = document.querySelector('.sidebar');
  const MIN_W    = 180;
  const MAX_W    = 400;
  const COLLAPSE_THRESHOLD = 120; // drag below this → collapse

  let startX     = 0;
  let startWidth = 0;
  let dragged    = false;
  let collapsed  = false;
  let lastWidth  = 240; // remembered width before collapse

  function setWidth(w) {
    sidebar.style.width = w + 'px';
  }

  handle.addEventListener('mousedown', e => {
    // Only primary button
    if (e.button !== 0) return;
    startX     = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    dragged    = false;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(e) {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) dragged = true;
      if (!dragged) return;

      // Temporarily remove transition for smooth live drag
      sidebar.style.transition = 'none';

      const newW = startWidth + dx;
      if (newW < COLLAPSE_THRESHOLD) {
        sidebar.classList.add('collapsed');
        collapsed = true;
      } else {
        sidebar.classList.remove('collapsed');
        collapsed = false;
        setWidth(Math.min(MAX_W, Math.max(MIN_W, newW)));
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Restore transition
      sidebar.style.transition = '';

      if (!dragged) {
        // Pure click → toggle collapse
        toggleCollapse();
      } else if (!collapsed) {
        // Save last good width
        lastWidth = sidebar.getBoundingClientRect().width;
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  function toggleCollapse() {
    collapsed = !collapsed;
    if (collapsed) {
      lastWidth = sidebar.getBoundingClientRect().width || lastWidth;
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      setWidth(lastWidth);
    }
  }
})();

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => activateView(item.dataset.view));
});

(async function init() {
  // Load data from Supabase (or stay local if not configured)
  await DB.init();
  renderSidebar();
  activateView('today');
  updateBadges();
  updateAvatarBtn();
})();

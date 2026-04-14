// ════════════════════════════════════════════════════════════
// Papertray — Database layer (Supabase)
//
// Exposes window.DB with async methods for all data operations.
// Falls back silently to in-memory mode if Supabase is not
// configured (SUPABASE_URL still contains 'YOUR_SUPABASE_URL').
// ════════════════════════════════════════════════════════════

(function () {

  // ── Init Supabase client ────────────────────────────────
  const _configured = typeof SUPABASE_URL !== 'undefined'
    && SUPABASE_URL !== 'YOUR_SUPABASE_URL'
    && typeof window.supabase !== 'undefined';

  const _sb = _configured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  if (!_configured) {
    console.info('[DB] Supabase not configured — running in local-only mode.');
  }

  // ── Session helpers ─────────────────────────────────────
  async function getSession() {
    if (!_sb) return null;
    const { data } = await _sb.auth.getSession();
    return data.session;
  }

  async function getUserId() {
    const s = await getSession();
    return s ? s.user.id : null;
  }

  // ── Auth ────────────────────────────────────────────────
  async function signUp(email, password, firstName, lastName) {
    if (!_sb) return { error: { message: 'Supabase not configured' } };
    return _sb.auth.signUp({
      email, password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
  }

  async function signIn(email, password) {
    if (!_sb) return { error: { message: 'Supabase not configured' } };
    return _sb.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    if (!_sb) return;
    await _sb.auth.signOut();
    window.location.href = 'login.html';
  }

  // Listen for auth state changes (redirect to login if signed out)
  if (_sb) {
    _sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
    });
  }

  // ── Bootstrap: load all data on startup ────────────────
  async function init() {
    if (!_sb) return false; // stay with hardcoded data.js data

    const uid = await getUserId();
    if (!uid) {
      // Not logged in → redirect
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
      return false;
    }

    const [
      { data: profileRows },
      { data: areaRows },
      { data: projectRows },
      { data: headingRows },
      { data: taskRows },
    ] = await Promise.all([
      _sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      _sb.from('areas').select('*').eq('user_id', uid).order('order_idx', { nullsFirst: false }).order('created_at'),
      _sb.from('projects').select('*').eq('user_id', uid).order('order_idx', { nullsFirst: false }).order('created_at'),
      _sb.from('headings').select('*').eq('user_id', uid).order('order_idx'),
      _sb.from('tasks').select('*').eq('user_id', uid).order('order_idx'),
    ]);

    // Only replace globals if there is data in the DB
    if (areaRows && areaRows.length) {
      AREAS.length = 0;
      areaRows.forEach(r => AREAS.push({
        id: r.id, name: r.name,
        isShared: r.is_shared, collaborators: [],
      }));
    }

    if (projectRows && projectRows.length) {
      PROJECTS.length = 0;
      projectRows.forEach(r => PROJECTS.push({
        id: r.id, areaId: r.area_id, name: r.name, collaborators: [],
      }));
    }

    if (headingRows && headingRows.length) {
      HEADINGS.length = 0;
      headingRows.forEach(r => HEADINGS.push({
        id: r.id, projectId: r.project_id, name: r.name, order: r.order_idx,
      }));
    }

    if (taskRows && taskRows.length) {
      TASKS.length = 0;
      taskRows.forEach(r => TASKS.push({
        id:         r.id,
        projectId:  r.project_id,
        name:       r.name,
        status:     r.status,
        bucket:     r.bucket,
        section:    r.section,
        assigneeId: r.assignee_id,
        tags:       r.tags || [],
        dueLabel:   r.due_label,
        dueDate:    r.due_date,
      }));
    }

    // Profile
    if (profileRows) {
      USER_PROFILE.firstName = profileRows.first_name || USER_PROFILE.firstName;
      USER_PROFILE.lastName  = profileRows.last_name  || USER_PROFILE.lastName;
      USER_PROFILE.email     = profileRows.email      || USER_PROFILE.email;
      USER_PROFILE.photo     = profileRows.photo      || USER_PROFILE.photo;
    } else {
      // First login — seed profile from USER_PROFILE defaults
      await _sb.from('profiles').upsert({
        id:         uid,
        first_name: USER_PROFILE.firstName,
        last_name:  USER_PROFILE.lastName,
        email:      USER_PROFILE.email,
      });
    }

    return true;
  }

  // ── Seed: push all in-memory data to a fresh DB ────────
  async function seedAll() {
    if (!_sb) return;
    const uid = await getUserId();
    if (!uid) return;

    await Promise.all([
      ...AREAS.map((a, i) => _sb.from('areas').upsert({
        id: a.id, user_id: uid, name: a.name, is_shared: a.isShared, order_idx: i,
      })),
      ...PROJECTS.map((p, i) => _sb.from('projects').upsert({
        id: p.id, user_id: uid, area_id: p.areaId, name: p.name, order_idx: i,
      })),
      ...HEADINGS.map((h, i) => _sb.from('headings').upsert({
        id: h.id, user_id: uid, project_id: h.projectId, name: h.name, order_idx: h.order,
      })),
      ...TASKS.map((t, i) => _sb.from('tasks').upsert({
        id: t.id, user_id: uid, project_id: t.projectId, name: t.name,
        status: t.status, bucket: t.bucket, section: t.section,
        assignee_id: t.assigneeId, tags: t.tags, due_label: t.dueLabel,
        due_date: t.dueDate || null, order_idx: i,
      })),
    ]);
    console.info('[DB] Seed complete.');
  }

  // ── Tasks ───────────────────────────────────────────────
  async function createTask(task) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('tasks').insert({
      id: task.id, user_id: uid, project_id: task.projectId, name: task.name,
      status: task.status, bucket: task.bucket, section: task.section,
      assignee_id: task.assigneeId, tags: task.tags,
      due_label: task.dueLabel, due_date: task.dueDate || null,
      order_idx: TASKS.length,
    });
  }

  async function updateTask(id, patch) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    // Map JS camelCase → DB snake_case
    const row = {};
    if ('status'     in patch) row.status      = patch.status;
    if ('bucket'     in patch) row.bucket      = patch.bucket;
    if ('section'    in patch) row.section     = patch.section;
    if ('assigneeId' in patch) row.assignee_id = patch.assigneeId;
    if ('projectId'  in patch) row.project_id  = patch.projectId;
    if ('dueLabel'   in patch) row.due_label   = patch.dueLabel;
    if ('dueDate'    in patch) row.due_date    = patch.dueDate || null;
    if ('name'       in patch) row.name        = patch.name;
    if ('tags'       in patch) row.tags        = patch.tags;
    if (!Object.keys(row).length) return;
    await _sb.from('tasks').update(row).eq('id', id).eq('user_id', uid);
  }

  async function deleteTask(id) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('tasks').delete().eq('id', id).eq('user_id', uid);
  }

  // ── Areas ───────────────────────────────────────────────
  async function createArea(area) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('areas').insert({
      id: area.id, user_id: uid, name: area.name,
      is_shared: area.isShared, order_idx: AREAS.length,
    });
  }

  async function updateArea(id, patch) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    const row = {};
    if ('name'          in patch) row.name          = patch.name;
    if ('isShared'      in patch) row.is_shared      = patch.isShared;
    if ('collaborators' in patch) row.collaborators  = patch.collaborators;
    await _sb.from('areas').update(row).eq('id', id).eq('user_id', uid);
  }

  async function deleteArea(id) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('areas').delete().eq('id', id).eq('user_id', uid);
  }

  // ── Projects ────────────────────────────────────────────
  async function createProject(project) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('projects').insert({
      id: project.id, user_id: uid, area_id: project.areaId,
      name: project.name, order_idx: PROJECTS.length,
    });
  }

  async function updateProject(id, patch) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    const row = {};
    if ('name'          in patch) row.name          = patch.name;
    if ('areaId'        in patch) row.area_id        = patch.areaId;
    if ('collaborators' in patch) row.collaborators  = patch.collaborators;
    if ('orderIdx'      in patch) row.order_idx      = patch.orderIdx;
    await _sb.from('projects').update(row).eq('id', id).eq('user_id', uid);
  }

  async function deleteProject(id) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('projects').delete().eq('id', id).eq('user_id', uid);
  }

  // ── Headings ────────────────────────────────────────────
  async function createHeading(heading) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('headings').insert({
      id: heading.id, user_id: uid, project_id: heading.projectId,
      name: heading.name, order_idx: heading.order,
    });
  }

  async function updateHeading(id, patch) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    const row = {};
    if ('name'  in patch) row.name      = patch.name;
    if ('order' in patch) row.order_idx = patch.order;
    await _sb.from('headings').update(row).eq('id', id).eq('user_id', uid);
  }

  async function deleteHeading(id) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    await _sb.from('headings').delete().eq('id', id).eq('user_id', uid);
  }

  // ── Profile ─────────────────────────────────────────────
  async function updateProfile(patch) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;
    const row = {};
    if ('firstName' in patch) row.first_name = patch.firstName;
    if ('lastName'  in patch) row.last_name  = patch.lastName;
    if ('email'     in patch) row.email      = patch.email;
    if ('photo'     in patch) row.photo      = patch.photo;
    await _sb.from('profiles').update(row).eq('id', uid);
  }

  // ── Realtime subscription ───────────────────────────────
  let _realtimeChannel = null;

  async function subscribeRealtime(onChange) {
    if (!_sb) return;
    const uid = await getUserId(); if (!uid) return;

    if (_realtimeChannel) _sb.removeChannel(_realtimeChannel);

    _realtimeChannel = _sb
      .channel('papertray-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',    filter: `user_id=eq.${uid}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${uid}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'areas',    filter: `user_id=eq.${uid}` }, onChange)
      .subscribe();
  }

  // ── Public API ──────────────────────────────────────────
  window.DB = {
    // Auth
    signUp, signIn, signOut, getSession, getUserId,
    // Bootstrap
    init, seedAll,
    // Tasks
    createTask, updateTask, deleteTask,
    // Areas
    createArea, updateArea, deleteArea,
    // Projects
    createProject, updateProject, deleteProject,
    // Headings
    createHeading, updateHeading, deleteHeading,
    // Profile
    updateProfile,
    // Realtime
    subscribeRealtime,
    // Utility
    isConfigured: () => _configured,
    client: () => _sb,
  };

})();

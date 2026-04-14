// ─── User profile & subscription ──────────────────────────
const USER_PROFILE = {
  firstName:    'Diogo',
  lastName:     'Caetano',
  email:        'diogo@papertray.app',
  photo:        null,
  subscription: {
    plan:     'Collaborator Pro',
    seats:    5,
    members: [
      { collabId: 'AL', role: 'owner'  },
      { collabId: 'M',  role: 'member' },
      { collabId: 'R',  role: 'member' },
    ],
  },
};

// ─── Collaborators ─────────────────────────────────────────
const COLLABORATORS = {
  AL: { id: 'AL', initials: 'AL', name: 'Alex Lee',   color: 'var(--c1)' },
  M:  { id: 'M',  initials: 'M',  name: 'Maya Patel', color: 'var(--c2)' },
  R:  { id: 'R',  initials: 'R',  name: 'Ryan Osei',  color: 'var(--c3)' },
  J:  { id: 'J',  initials: 'J',  name: 'Jordan Kim', color: 'var(--c4)' },
  S:  { id: 'S',  initials: 'S',  name: 'Sara Motta', color: 'var(--c5)' },
};

// ─── Areas ─────────────────────────────────────────────────
const AREAS = [
  { id: 'work',     name: 'Work',     isShared: true,  collaborators: ['AL','M','R'] },
  { id: 'personal', name: 'Personal', isShared: false, collaborators: [] },
];

// ─── Projects ──────────────────────────────────────────────
const PROJECTS = [
  { id: 'brand', areaId: 'work',     name: 'Brand Refresh', collaborators: ['AL','M'] },
  { id: 'q3',    areaId: 'work',     name: 'Q3 Roadmap',    collaborators: ['R'] },
  { id: 'ios',   areaId: 'work',     name: 'iOS Redesign',  collaborators: ['AL','M','J'] },
  { id: 'home',  areaId: 'personal', name: 'Home',          collaborators: [] },
];

// ─── Tasks ─────────────────────────────────────────────────
let TASKS = [

  // ── Brand Refresh ───────────────────────────────────────
  { id: 't1', projectId: 'brand', name: 'Audit current brand assets',   status: 'done', bucket: 'anytime', section: 'This week', assigneeId: 'AL', tags: ['Discovery'],     dueLabel: null },
  { id: 't2', projectId: 'brand', name: 'Competitive analysis',         status: 'done', bucket: 'anytime', section: 'This week', assigneeId: 'M',  tags: ['Research'],      dueLabel: null },
  { id: 't3', projectId: 'brand', name: 'Kick-off meeting notes',       status: 'done', bucket: 'anytime', section: 'This week', assigneeId: 'R',  tags: [],                dueLabel: null },
  { id: 't4', projectId: 'brand', name: 'Define new typography system', status: 'open', bucket: 'today',   section: 'This week', assigneeId: 'AL', tags: ['Type'],          dueLabel: 'Today' },
  { id: 't5', projectId: 'brand', name: 'Present moodboards to team',   status: 'open', bucket: 'today',   section: 'This week', assigneeId: 'R',  tags: ['Presentation'],  dueLabel: 'Today' },
  { id: 't6', projectId: 'brand', name: 'Finalize color palette',       status: 'open', bucket: 'upcoming',section: 'This week', assigneeId: 'M',  tags: ['Color'],         dueLabel: 'Thu 17' },
  { id: 't7', projectId: 'brand', name: 'Redesign logo lockup',         status: 'open', bucket: 'upcoming',section: 'Later',     assigneeId: 'AL', tags: [],                dueLabel: 'Apr 24' },
  { id: 't8', projectId: 'brand', name: 'Build brand guidelines doc',   status: 'open', bucket: 'upcoming',section: 'Later',     assigneeId: 'J',  tags: ['Docs'],          dueLabel: 'May 2' },
  { id: 't9', projectId: 'brand', name: 'Handoff to engineering',       status: 'open', bucket: 'upcoming',section: 'Later',     assigneeId: 'M',  tags: [],                dueLabel: 'May 10' },

  // ── Q3 Roadmap ──────────────────────────────────────────
  { id: 'q1',  projectId: 'q3', name: 'Collect feature requests from sales', status: 'done', bucket: 'anytime', section: 'This week', assigneeId: 'R', tags: ['Research'], dueLabel: null },
  { id: 'q2',  projectId: 'q3', name: 'Prioritise backlog with PM',          status: 'open', bucket: 'today',   section: 'This week', assigneeId: 'R', tags: [],           dueLabel: 'Today' },
  { id: 'q3t', projectId: 'q3', name: 'Capacity planning with engineering',  status: 'open', bucket: 'upcoming',section: 'This week', assigneeId: 'R', tags: [],           dueLabel: 'Thu 17' },
  { id: 'q4',  projectId: 'q3', name: 'Write roadmap narrative doc',         status: 'open', bucket: 'upcoming',section: 'Later',     assigneeId: 'R', tags: ['Docs'],     dueLabel: 'Apr 24' },
  { id: 'q5',  projectId: 'q3', name: 'Stakeholder review',                  status: 'open', bucket: 'upcoming',section: 'Later',     assigneeId: 'R', tags: [],           dueLabel: 'Apr 28' },
  { id: 'q6',  projectId: 'q3', name: 'Publish roadmap to Notion',           status: 'open', bucket: 'upcoming',section: 'Later',     assigneeId: 'R', tags: [],           dueLabel: 'May 5' },

  // ── iOS Redesign ────────────────────────────────────────
  { id: 'i1',  projectId: 'ios', name: 'Kickoff with design & eng',      status: 'open', bucket: 'today',    section: 'This week', assigneeId: 'AL', tags: [],           dueLabel: 'Today' },
  { id: 'i2',  projectId: 'ios', name: 'Audit current iOS screens',      status: 'open', bucket: 'upcoming', section: 'This week', assigneeId: 'M',  tags: ['Audit'],    dueLabel: 'Thu 17' },
  { id: 'i3',  projectId: 'ios', name: 'User interview synthesis',       status: 'open', bucket: 'upcoming', section: 'This week', assigneeId: 'J',  tags: ['Research'], dueLabel: 'Fri 18' },
  { id: 'i4',  projectId: 'ios', name: 'Information architecture map',   status: 'open', bucket: 'upcoming', section: 'Later',     assigneeId: 'AL', tags: ['IA'],       dueLabel: 'Apr 22' },
  { id: 'i5',  projectId: 'ios', name: 'Wireframes: onboarding flow',    status: 'open', bucket: 'upcoming', section: 'Later',     assigneeId: 'M',  tags: ['Wireframe'],dueLabel: 'Apr 24' },
  { id: 'i6',  projectId: 'ios', name: 'Wireframes: core navigation',    status: 'open', bucket: 'upcoming', section: 'Later',     assigneeId: 'M',  tags: ['Wireframe'],dueLabel: 'Apr 28' },
  { id: 'i7',  projectId: 'ios', name: 'Design token library',           status: 'open', bucket: 'upcoming', section: 'Later',     assigneeId: 'J',  tags: ['Tokens'],   dueLabel: 'May 1' },
  { id: 'i8',  projectId: 'ios', name: 'Hi-fi: tab bar & navigation',   status: 'open', bucket: 'someday',  section: 'Later',     assigneeId: 'AL', tags: [],           dueLabel: null },
  { id: 'i9',  projectId: 'ios', name: 'Prototype interactive flows',    status: 'open', bucket: 'someday',  section: 'Later',     assigneeId: 'M',  tags: [],           dueLabel: null },
  { id: 'i10', projectId: 'ios', name: 'Accessibility review',           status: 'open', bucket: 'someday',  section: 'Later',     assigneeId: 'J',  tags: ['A11y'],     dueLabel: null },
  { id: 'i11', projectId: 'ios', name: 'Handoff specs to engineering',   status: 'open', bucket: 'someday',  section: 'Later',     assigneeId: 'AL', tags: [],           dueLabel: null },
  { id: 'i12', projectId: 'ios', name: 'QA sign-off',                    status: 'open', bucket: 'someday',  section: 'Later',     assigneeId: 'J',  tags: [],           dueLabel: null },

  // ── Home ────────────────────────────────────────────────
  { id: 'h1', projectId: 'home', name: 'Fix leaky tap in bathroom',   status: 'done', bucket: 'anytime', section: null, assigneeId: null, tags: [], dueLabel: null },
  { id: 'h2', projectId: 'home', name: 'Replace kitchen light bulbs', status: 'done', bucket: 'anytime', section: null, assigneeId: null, tags: [], dueLabel: null },
  { id: 'h3', projectId: 'home', name: 'Paint hallway',               status: 'done', bucket: 'anytime', section: null, assigneeId: null, tags: [], dueLabel: null },
  { id: 'h4', projectId: 'home', name: 'Book boiler service',         status: 'open', bucket: 'today',   section: null, assigneeId: null, tags: [], dueLabel: 'Today' },
  { id: 'h5', projectId: 'home', name: 'Order new sofa',              status: 'open', bucket: 'anytime', section: null, assigneeId: null, tags: [], dueLabel: null },
  { id: 'h6', projectId: 'home', name: 'Declutter garage',            status: 'open', bucket: 'someday', section: null, assigneeId: null, tags: [], dueLabel: null },

  // ── Inbox ───────────────────────────────────────────────
  { id: 'in1', projectId: null, name: 'Look into Figma Variables for theming', status: 'open', bucket: 'inbox', section: null, assigneeId: null, tags: [], dueLabel: null },
  { id: 'in2', projectId: null, name: 'Send contract to legal for review',     status: 'open', bucket: 'inbox', section: null, assigneeId: null, tags: [], dueLabel: null },
  { id: 'in3', projectId: null, name: 'Reply to Tom about the conf talk',      status: 'open', bucket: 'inbox', section: null, assigneeId: null, tags: [], dueLabel: null },
];

// ─── Headings ──────────────────────────────────────────────
// Headings divide a project into named sections/milestones.
// Tasks reference their heading via task.section === heading.name.
let HEADINGS = [
  { id: 'hb1', projectId: 'brand', name: 'This week', order: 0 },
  { id: 'hb2', projectId: 'brand', name: 'Later',     order: 1 },
  { id: 'hq1', projectId: 'q3',    name: 'This week', order: 0 },
  { id: 'hq2', projectId: 'q3',    name: 'Later',     order: 1 },
  { id: 'hi1', projectId: 'ios',   name: 'This week', order: 0 },
  { id: 'hi2', projectId: 'ios',   name: 'Later',     order: 1 },
];

function getHeadingsForProject(projectId) {
  return HEADINGS
    .filter(h => h.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

// ─── Helpers ───────────────────────────────────────────────
function getProject(id) { return PROJECTS.find(p => p.id === id) || null; }
function getArea(id)    { return AREAS.find(a => a.id === id) || null; }
function getTask(id)    { return TASKS.find(t => t.id === id) || null; }

function projectTasks(projectId) {
  return TASKS.filter(t => t.projectId === projectId && t.status !== 'trash');
}

function projectProgress(projectId) {
  const tasks = projectTasks(projectId);
  const done  = tasks.filter(t => t.status === 'done').length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

function viewTasks(view) {
  switch (view) {
    case 'inbox':    return TASKS.filter(t => t.bucket === 'inbox'    && t.status !== 'trash');
    case 'today':    return TASKS.filter(t => t.bucket === 'today'    && t.status === 'open');
    case 'upcoming': return TASKS.filter(t => t.bucket === 'upcoming' && t.status === 'open');
    case 'anytime':  return TASKS.filter(t => t.bucket === 'anytime'  && t.status === 'open');
    case 'someday':  return TASKS.filter(t => t.bucket === 'someday'  && t.status === 'open');
    case 'logbook':  return TASKS.filter(t => t.status === 'done');
    case 'trash':    return TASKS.filter(t => t.status === 'trash');
    default:         return [];
  }
}

let _uid = 1000;
function nextId() { return 'u' + (++_uid); }

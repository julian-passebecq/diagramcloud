/** Transient reading preferences, not a Project, permission, route or execution store. */
export const DESTINATIONS = ['projects', 'catalogue', 'meetings', 'activity'] as const;
export type Destination = typeof DESTINATIONS[number];
export const TASKS = ['explain', 'design', 'compare', 'present'] as const;
export type ReadingTask = typeof TASKS[number];
export const BUILDER_LEVELS = ['off', 'roles', 'systems', 'sessions', 'runs', 'operations'] as const;
export type BuilderLevel = typeof BUILDER_LEVELS[number];
export const DOCK_PANELS = ['route', 'evidence', 'changes', 'git', 'work', 'questions', 'decisions'] as const;
export type DockPanel = typeof DOCK_PANELS[number];
export const DESTINATION_TOPICS: Record<Destination, readonly string[]> = {
  projects: ['home', 'recent', 'collections'],
  catalogue: ['home', 'patterns', 'technologies', 'case-studies', 'procedures'],
  meetings: ['home', 'briefs', 'walkthroughs', 'questions'],
  activity: ['home', 'changes', 'reviews', 'work', 'agents']
};
export type PerspectiveBinding = {projectId: string; audience: 'author' | 'public'; epoch: number};
export type ReadingChoice = {id: string; label: string; state: 'available' | 'not-loaded' | 'unsupported'};
export type PerspectiveSupport = {
  binding: PerspectiveBinding;
  lenses: readonly ReadingChoice[];
  details: readonly ReadingChoice[];
  builderLevels: readonly BuilderLevel[];
  panels: readonly DockPanel[];
  /** Empty is valid: the current project may have no supported edit/compare/present workflow. */
  tasks: readonly ReadingTask[];
};
export type WorkbenchPerspective = {
  binding: PerspectiveBinding;
  destination: Destination;
  topic: string;
  task: ReadingTask;
  lens: string;
  detail: string;
  builders: BuilderLevel;
  dock: {open: boolean; primary: DockPanel; secondary: DockPanel | null; customized: boolean};
};
export type PerspectiveChange =
  | {type: 'destination'; value: Destination}
  | {type: 'topic'; value: string}
  | {type: 'task'; value: ReadingTask}
  | {type: 'lens' | 'detail'; value: string}
  | {type: 'builders'; value: BuilderLevel}
  | {type: 'dock-open'; value: boolean}
  | {type: 'dock-primary' | 'dock-secondary'; value: DockPanel | null}
  | {type: 'dock-reset'};
export const PERSPECTIVE_UNAVAILABLE = 'This control is unavailable in the current context.';
export function samePerspectiveBinding(a: PerspectiveBinding, b: PerspectiveBinding): boolean {
  return a.projectId === b.projectId && a.audience === b.audience && a.epoch === b.epoch;
}
export function suggestedDock(task: ReadingTask): WorkbenchPerspective['dock'] {
  const panels: Record<ReadingTask, [DockPanel, DockPanel | null]> = {
    explain: ['route', 'evidence'], design: ['decisions', 'evidence'],
    compare: ['changes', 'evidence'], present: ['route', 'questions']
  };
  const [primary, secondary] = panels[task];
  return {open: task !== 'present', primary, secondary, customized: false};
}
function fitDock(task: ReadingTask, support: PerspectiveSupport): WorkbenchPerspective['dock'] {
  const next = suggestedDock(task);
  const fallback = support.panels[0];
  if (!support.panels.includes(next.primary)) {
    if (!fallback) return {...next, open: false, secondary: null};
    next.primary = fallback;
  }
  if (next.secondary === next.primary || !support.panels.includes(next.secondary!)) next.secondary = null;
  return next;
}
/** The native host supplies permitted source-backed choices; no view is generated or guessed. */
export function createWorkbenchPerspective(support: PerspectiveSupport): WorkbenchPerspective {
  const lens = support.lenses.find(x => x.state === 'available')?.id ?? '';
  const detail = support.details.find(x => x.state === 'available')?.id ?? '';
  const task = support.tasks[0] ?? 'explain';
  return {binding: {...support.binding}, destination: 'projects', topic: 'home', task,
    lens, detail, builders: 'off', dock: fitDock(task, support)};
}
/** Returns a copied request state. The App must still resolve navigation and enforce Edit capabilities. */
export function changeWorkbenchPerspective(state: WorkbenchPerspective, intent: PerspectiveChange,
  issuedAt: PerspectiveBinding, support: PerspectiveSupport):
  {ok: true; state: WorkbenchPerspective} | {ok: false; state: WorkbenchPerspective; reason: string} {
  const refused = () => ({ok: false as const, state, reason: PERSPECTIVE_UNAVAILABLE});
  if (!samePerspectiveBinding(issuedAt, support.binding) || !samePerspectiveBinding(state.binding, support.binding)) return refused();
  const next: WorkbenchPerspective = {...state, binding: {...state.binding}, dock: {...state.dock}};
  switch (intent.type) {
    case 'destination':
      if (!DESTINATIONS.includes(intent.value)) return refused();
      next.destination = intent.value; next.topic = 'home'; break;
    case 'topic':
      if (!DESTINATION_TOPICS[state.destination].includes(intent.value)) return refused();
      next.topic = intent.value; break;
    case 'task':
      if (!TASKS.includes(intent.value) || !support.tasks.includes(intent.value)) return refused();
      next.task = intent.value;
      if (!state.dock.customized) next.dock = fitDock(intent.value, support);
      break;
    case 'lens': case 'detail': {
      const choices = intent.type === 'lens' ? support.lenses : support.details;
      if (!choices.some(c => c.id === intent.value && c.state === 'available')) return refused();
      next[intent.type] = intent.value; break;
    }
    case 'builders':
      if (!BUILDER_LEVELS.includes(intent.value) || (intent.value !== 'off' && !support.builderLevels.includes(intent.value))) return refused();
      next.builders = intent.value; break;
    case 'dock-open':
      if (typeof intent.value !== 'boolean' || (intent.value && !support.panels.length)) return refused();
      next.dock.open = intent.value; next.dock.customized = true; break;
    case 'dock-primary':
      if (!intent.value || !support.panels.includes(intent.value)) return refused();
      if (state.dock.secondary === intent.value) next.dock.secondary = state.dock.primary;
      next.dock.primary = intent.value; next.dock.customized = true; break;
    case 'dock-secondary':
      if (intent.value !== null && (!support.panels.includes(intent.value) || intent.value === state.dock.primary)) return refused();
      next.dock.secondary = intent.value; next.dock.customized = true; break;
    case 'dock-reset': next.dock = fitDock(state.task, support); break;
    default: return refused();
  }
  return {ok: true, state: next};
}
/** Source refresh cannot replay old controls. Cross-project/audience changes reset transient preferences. */
export function reconcileWorkbenchPerspective(state: WorkbenchPerspective, support: PerspectiveSupport):
  {state: WorkbenchPerspective; changed: string[]} {
  if (state.binding.projectId !== support.binding.projectId || state.binding.audience !== support.binding.audience)
    return {state: createWorkbenchPerspective(support), changed: ['context']};
  const next = {...state, binding: {...support.binding}, dock: {...state.dock}};
  const changed: string[] = [];
  for (const key of ['lens', 'detail'] as const) {
    const choices = key === 'lens' ? support.lenses : support.details;
    if (next[key] && !choices.some(c => c.id === next[key] && c.state === 'available')) {
      // Preserve absence visibly; do not navigate to a different architecture automatically.
      next[key] = ''; changed.push(key);
    }
  }
  if (next.builders !== 'off' && !support.builderLevels.includes(next.builders)) {next.builders = 'off'; changed.push('builders');}
  if (!support.tasks.includes(next.task)) {next.task = support.tasks[0] ?? 'explain'; changed.push('task');}
  if (!support.panels.includes(next.dock.primary)) {next.dock = fitDock(next.task, support); changed.push('dock');}
  else if (next.dock.secondary && !support.panels.includes(next.dock.secondary)) {next.dock.secondary = null; changed.push('dock-secondary');}
  return {state: next, changed};
}
/** Facets, not an invented containment hierarchy. IDs must be source-qualified, never display labels.
 * Product agents remain architecture nodes; changing this builder overlay never removes them. */
export type BuilderIdentity = {
  id: string; roleId?: string; systemId?: string; sessionId?: string; runId?: string; operationId?: string;
  surface?: string; model?: string;
};
export function builderGrouping(identity: BuilderIdentity, level: BuilderLevel):
  {state: 'hidden' | 'unknown'} | {state: 'known'; key: string} {
  if (level === 'off') return {state: 'hidden'};
  const field = {roles: 'roleId', systems: 'systemId', sessions: 'sessionId', runs: 'runId', operations: 'operationId'} as const;
  const value = identity[field[level]];
  return typeof value === 'string' && value.trim() ? {state: 'known', key: JSON.stringify([level, value])} : {state: 'unknown'};
}

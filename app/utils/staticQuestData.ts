import {
  CONFIRMED_QUEST_STATUSES,
  DEFAULT_STATIC_QUEST_DATA_BASE_URL,
  STATIC_QUEST_OUTPUT_NAMES,
  STATIC_QUEST_SCHEMA_VERSION,
  type ConfirmedQuestStatus,
  type StaticQuestBundle,
  type StaticQuestDataConfig,
  type StaticQuestFileMode,
  type StaticQuestNamedRef,
  type StaticQuestObjective,
  type StaticQuestOutputName,
  type StaticQuestScoreMap,
  type StaticQuestScoresDocument,
  type StaticQuestStateDocument,
  type StaticQuestStateEntry,
  type StaticQuestTask,
  type StaticQuestTasksDocument,
  type StaticQuestZone,
} from '@/types/staticQuestData';
import { GAME_MODES } from '@/utils/constants';
import { normalizeStaticQuestDataBaseUrl } from '@/utils/runtimeConfig';
import type { TaskCompletion, TaskObjective as ProgressObjective } from '@/types/progress';
import type { Task, TaskObjective, TarkovItem, TarkovMap, Trader } from '@/types/tarkov';
export class StaticQuestDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaticQuestDataError';
  }
}
export type AdaptedStaticQuestProgress = {
  taskCompletions: Record<string, TaskCompletion>;
  taskObjectives: Record<string, ProgressObjective>;
  unlockedTaskIds: string[];
};
export type AdaptedStaticQuestData = {
  fileMode: StaticQuestFileMode;
  maps: TarkovMap[];
  progress: AdaptedStaticQuestProgress;
  scores: StaticQuestScoreMap[];
  tasks: Task[];
  traders: Trader[];
};
type StaticHydrationRequest = {
  generation: number;
  signal: AbortSignal;
};
let hydrationGeneration = 0;
let hydrationAbort: AbortController | null = null;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isConfirmedStatus = (value: unknown): value is ConfirmedQuestStatus =>
  CONFIRMED_QUEST_STATUSES.includes(value as ConfirmedQuestStatus);
const isOutputName = (value: string): value is StaticQuestOutputName =>
  STATIC_QUEST_OUTPUT_NAMES.includes(value as StaticQuestOutputName);
const readString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;
export const resolveStaticQuestFileMode = (gameMode: string): StaticQuestFileMode =>
  gameMode === GAME_MODES.PVE ? 'pve' : 'pvp';
export const buildStaticQuestFileUrl = (
  baseUrl: string,
  name: StaticQuestOutputName,
  fileMode: StaticQuestFileMode
): string => {
  if (!isOutputName(name)) {
    throw new StaticQuestDataError(`unsupported static quest file name: ${name}`);
  }
  const normalizedBase = normalizeStaticQuestDataBaseUrl(baseUrl);
  return `${normalizedBase}/${name}.${fileMode}.json`;
};
export const getStaticQuestDataConfig = (): StaticQuestDataConfig => {
  const publicConfig = useRuntimeConfig().public as {
    staticQuestData?: Partial<StaticQuestDataConfig>;
  };
  const enabled = publicConfig.staticQuestData?.enabled === true;
  const baseUrl = normalizeStaticQuestDataBaseUrl(
    publicConfig.staticQuestData?.baseUrl || DEFAULT_STATIC_QUEST_DATA_BASE_URL
  );
  return { enabled, baseUrl };
};
export const isStaticQuestDataEnabled = (): boolean => {
  try {
    return getStaticQuestDataConfig().enabled;
  } catch {
    return false;
  }
};
export const beginStaticQuestHydration = (): StaticHydrationRequest => {
  hydrationAbort?.abort();
  hydrationAbort = new AbortController();
  hydrationGeneration += 1;
  return { generation: hydrationGeneration, signal: hydrationAbort.signal };
};
export const isCurrentStaticQuestHydration = (generation: number): boolean =>
  generation === hydrationGeneration;
export const resetStaticQuestHydrationForTests = (): void => {
  hydrationAbort?.abort();
  hydrationAbort = null;
  hydrationGeneration = 0;
};
const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError';
};
const fetchJsonDocument = async (url: string, signal: AbortSignal): Promise<unknown> => {
  const fetcher = (
    globalThis as { $fetch?: (input: string, opts?: { signal?: AbortSignal }) => Promise<unknown> }
  ).$fetch;
  try {
    if (typeof fetcher === 'function') {
      return await fetcher(url, { signal });
    }
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new StaticQuestDataError(`failed to load ${url}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof StaticQuestDataError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new StaticQuestDataError(`failed to load ${url}: ${message}`);
  }
};
const requireDocument = (
  value: unknown,
  fileMode: StaticQuestFileMode,
  kind: StaticQuestOutputName
): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new StaticQuestDataError(`${kind}.${fileMode}.json must contain a JSON object`);
  }
  if (value.schema_version !== STATIC_QUEST_SCHEMA_VERSION) {
    throw new StaticQuestDataError(
      `${kind}.${fileMode}.json has unsupported schema_version ${String(value.schema_version)}`
    );
  }
  if (value.mode !== fileMode) {
    throw new StaticQuestDataError(
      `${kind}.${fileMode}.json mode ${String(value.mode)} does not match ${fileMode}`
    );
  }
  return value;
};
const parseNamedRef = (value: unknown): StaticQuestNamedRef => {
  if (!isRecord(value)) return { id: '', english_name: '' };
  const id = readString(value.id);
  return { id, english_name: readString(value.english_name, id) };
};
const parseZone = (value: unknown): StaticQuestZone | null => {
  if (!isRecord(value)) return null;
  const sourceMap = readString(value.map);
  const mapId = readString(value.map_id, sourceMap);
  return {
    ...value,
    id: readString(value.id),
    map: sourceMap,
    map_id: mapId,
  };
};
const parseObjective = (value: unknown): StaticQuestObjective | null => {
  if (!isRecord(value)) return null;
  const mapIds = Array.isArray(value.map_ids)
    ? value.map_ids.filter((id): id is string => typeof id === 'string')
    : [];
  const requiredItems = Array.isArray(value.required_items)
    ? value.required_items.map((item) => parseNamedRef(item))
    : [];
  const zones = Array.isArray(value.zones)
    ? value.zones
        .map((zone) => parseZone(zone))
        .filter((zone): zone is StaticQuestZone => zone !== null)
    : [];
  return {
    id: readString(value.id),
    english_description: readString(value.english_description),
    type: readString(value.type),
    optional: value.optional === true,
    map_ids: mapIds,
    required_items: requiredItems,
    zones,
  };
};
const parseTask = (questId: string, value: unknown): StaticQuestTask => {
  if (!isRecord(value)) {
    throw new StaticQuestDataError(`task ${questId} is not an object`);
  }
  const objectives = Array.isArray(value.objectives)
    ? value.objectives
        .map((objective) => parseObjective(objective))
        .filter((objective): objective is StaticQuestObjective => objective !== null)
    : [];
  const requiredKeys = Array.isArray(value.required_keys)
    ? value.required_keys.filter(isRecord).map((requirement) => ({
        map_id: readString(requirement.map_id),
        keys: Array.isArray(requirement.keys)
          ? requirement.keys.map((key) => parseNamedRef(key))
          : [],
      }))
    : [];
  const mapIds = Array.isArray(value.map_ids)
    ? value.map_ids.filter((id): id is string => typeof id === 'string')
    : [];
  const id = readString(value.id, questId);
  return {
    id,
    english_name: readString(value.english_name, id),
    trader: parseNamedRef(value.trader),
    map_ids: mapIds,
    required_keys: requiredKeys,
    objectives,
  };
};
const parseTasksDocument = (
  value: unknown,
  fileMode: StaticQuestFileMode
): StaticQuestTasksDocument => {
  const document = requireDocument(value, fileMode, 'tasks');
  if (!isRecord(document.tasks)) {
    throw new StaticQuestDataError(`tasks.${fileMode}.json is missing tasks`);
  }
  const tasks: Record<string, StaticQuestTask> = {};
  for (const [questId, task] of Object.entries(document.tasks)) {
    tasks[questId] = parseTask(questId, task);
  }
  return { mode: fileMode, schema_version: STATIC_QUEST_SCHEMA_VERSION, tasks };
};
const parseStateEntry = (questId: string, value: unknown): StaticQuestStateEntry => {
  if (!isRecord(value)) {
    throw new StaticQuestDataError(`quest ${questId} is not an object`);
  }
  if (!isConfirmedStatus(value.status)) {
    throw new StaticQuestDataError(
      `quest ${questId} has non-confirmed status ${JSON.stringify(value.status)}`
    );
  }
  const objectives = Array.isArray(value.objectives)
    ? value.objectives.filter(isRecord).map((objective) => ({
        id: readString(objective.id),
        optional: asBoolean(objective.optional),
        required: asBoolean(objective.required),
        completed: asBoolean(objective.completed),
        pending: asBoolean(objective.pending),
      }))
    : [];
  return {
    id: readString(value.id, questId),
    status: value.status,
    objectives,
  };
};
const parseStateDocument = (
  value: unknown,
  fileMode: StaticQuestFileMode
): StaticQuestStateDocument => {
  const document = requireDocument(value, fileMode, 'state');
  if (!isRecord(document.quests)) {
    throw new StaticQuestDataError(`state.${fileMode}.json is missing quests`);
  }
  const quests: Record<string, StaticQuestStateEntry> = {};
  for (const [questId, quest] of Object.entries(document.quests)) {
    quests[questId] = parseStateEntry(questId, quest);
  }
  return { mode: fileMode, schema_version: STATIC_QUEST_SCHEMA_VERSION, quests };
};
const parseScoresDocument = (
  value: unknown,
  fileMode: StaticQuestFileMode
): StaticQuestScoresDocument => {
  const document = requireDocument(value, fileMode, 'scores');
  const maps = Array.isArray(document.maps)
    ? document.maps.filter(isRecord).map((candidate) => {
        const quests = Array.isArray(candidate.quests)
          ? candidate.quests.filter(isRecord).map((quest) => ({
              id: readString(quest.id),
              english_name: readString(quest.english_name, readString(quest.id)),
              label: typeof quest.label === 'string' ? quest.label : null,
              gateway: quest.gateway === true || quest.label === 'gateway',
              off_goal: quest.off_goal === true || quest.label === 'off-goal',
              finishable_here: quest.finishable_here === true,
            }))
          : [];
        return {
          id: readString(candidate.id),
          english_name: readString(candidate.english_name, readString(candidate.id)),
          score: typeof candidate.score === 'number' ? candidate.score : null,
          gateway: candidate.gateway === true,
          off_goal: candidate.off_goal === true,
          finishable_here: candidate.finishable_here === true,
          quests,
        };
      })
    : [];
  return { mode: fileMode, schema_version: STATIC_QUEST_SCHEMA_VERSION, maps };
};
export const fetchStaticQuestBundle = async (
  gameMode: string,
  config: StaticQuestDataConfig = getStaticQuestDataConfig(),
  signal?: AbortSignal
): Promise<StaticQuestBundle> => {
  const fileMode = resolveStaticQuestFileMode(gameMode);
  const urls = {
    tasks: buildStaticQuestFileUrl(config.baseUrl, 'tasks', fileMode),
    state: buildStaticQuestFileUrl(config.baseUrl, 'state', fileMode),
    scores: buildStaticQuestFileUrl(config.baseUrl, 'scores', fileMode),
  };
  const [tasks, state, scores] = await Promise.all([
    fetchJsonDocument(urls.tasks, signal ?? new AbortController().signal),
    fetchJsonDocument(urls.state, signal ?? new AbortController().signal),
    fetchJsonDocument(urls.scores, signal ?? new AbortController().signal),
  ]);
  return {
    tasks: parseTasksDocument(tasks, fileMode),
    state: parseStateDocument(state, fileMode),
    scores: parseScoresDocument(scores, fileMode),
  };
};
const slugFromName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const humanizeId = (value: string): string =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const toItem = (ref: StaticQuestNamedRef): TarkovItem => ({
  id: ref.id,
  name: ref.english_name,
  normalizedName: slugFromName(ref.english_name || ref.id),
});
const adaptZone = (zone: StaticQuestZone): NonNullable<TaskObjective['zones']>[number] => {
  const mapId = zone.map_id || zone.map;
  return {
    ...zone,
    map: { id: mapId },
    outline: Array.isArray(zone.outline)
      ? zone.outline.map((point) => ({ x: point.x, y: point.y, z: point.z }))
      : undefined,
    position: zone.position
      ? { x: zone.position.x, y: zone.position.y, z: zone.position.z }
      : undefined,
  };
};
const adaptTask = (task: StaticQuestTask): Task => {
  const objectives: TaskObjective[] = task.objectives.map((objective) => {
    const items = objective.required_items.filter((item) => item.id).map((item) => toItem(item));
    const maps = objective.map_ids.map((id) => ({ id, name: humanizeId(id) }));
    return {
      id: objective.id,
      description: objective.english_description,
      type: objective.type,
      optional: objective.optional,
      maps,
      location: maps[0] ? { id: maps[0].id, name: maps[0].name } : undefined,
      items,
      item: items[0],
      zones: objective.zones.map((zone) => adaptZone(zone)),
    };
  });
  const requiredKeys = task.required_keys
    .filter((requirement) => requirement.keys.length > 0)
    .map((requirement) => ({
      keys: requirement.keys.filter((key) => key.id).map((key) => toItem(key)),
      maps: requirement.map_id
        ? [{ id: requirement.map_id, name: humanizeId(requirement.map_id) }]
        : [],
    }));
  const traderName = task.trader.english_name || task.trader.id;
  return {
    id: task.id,
    name: task.english_name,
    trader: task.trader.id
      ? {
          id: task.trader.id,
          name: traderName,
          normalizedName: slugFromName(traderName || task.trader.id),
        }
      : undefined,
    map: task.map_ids[0] ? { id: task.map_ids[0], name: humanizeId(task.map_ids[0]) } : undefined,
    objectives,
    requiredKeys,
  };
};
const collectMaps = (bundle: StaticQuestBundle): TarkovMap[] => {
  const maps = new Map<string, TarkovMap>();
  const remember = (id: string, name?: string) => {
    if (!id || maps.has(id)) return;
    maps.set(id, {
      id,
      name: name || humanizeId(id),
      normalizedName: id,
    });
  };
  for (const score of bundle.scores.maps) {
    remember(score.id, score.english_name);
  }
  for (const task of Object.values(bundle.tasks.tasks)) {
    task.map_ids.forEach((id) => remember(id));
    for (const objective of task.objectives) {
      objective.map_ids.forEach((id) => remember(id));
      for (const zone of objective.zones) {
        remember(zone.map_id || zone.map);
      }
    }
  }
  return [...maps.values()];
};
const collectTraders = (tasks: Task[]): Trader[] => {
  const traders = new Map<string, Trader>();
  for (const task of tasks) {
    const trader = task.trader;
    if (!trader?.id || traders.has(trader.id)) continue;
    traders.set(trader.id, {
      id: trader.id,
      name: trader.name || trader.id,
      normalizedName: trader.normalizedName,
      imageLink: trader.imageLink,
    });
  }
  return [...traders.values()];
};
export const adaptStaticQuestBundle = (bundle: StaticQuestBundle): AdaptedStaticQuestData => {
  const tasks = Object.values(bundle.tasks.tasks).map((task) => adaptTask(task));
  const taskCompletions: Record<string, TaskCompletion> = {};
  const taskObjectives: Record<string, ProgressObjective> = {};
  const unlockedTaskIds: string[] = [];
  for (const quest of Object.values(bundle.state.quests)) {
    if (quest.status === 'completed') {
      taskCompletions[quest.id] = { complete: true, failed: false };
    } else if (quest.status === 'failed') {
      taskCompletions[quest.id] = { complete: false, failed: true };
    } else {
      taskCompletions[quest.id] = { complete: false, failed: false };
      unlockedTaskIds.push(quest.id);
    }
    for (const objective of quest.objectives) {
      if (!objective.id) continue;
      taskObjectives[objective.id] = { complete: objective.completed === true };
    }
  }
  return {
    fileMode: bundle.tasks.mode,
    maps: collectMaps(bundle),
    progress: { taskCompletions, taskObjectives, unlockedTaskIds },
    scores: bundle.scores.maps,
    tasks,
    traders: collectTraders(tasks),
  };
};
export const fetchAndAdaptStaticQuestData = async (
  gameMode: string,
  config?: StaticQuestDataConfig,
  signal?: AbortSignal
): Promise<AdaptedStaticQuestData> => {
  const bundle = await fetchStaticQuestBundle(gameMode, config, signal);
  return adaptStaticQuestBundle(bundle);
};

import { GAME_MODES, type GameMode } from '@/utils/constants';
import type { UserProgressData, UserState } from '@/stores/progressState';
import type { TarkovDataQueryResult, TarkovItem, Task, TaskObjective } from '@/types/tarkov';
const STATIC_QUEST_SCHEMA_VERSION = 1;
const DEFAULT_STATIC_QUEST_BASE_URL = '/quest-data';
const DOCUMENT_NAMES = ['tasks', 'state', 'scores'] as const;
type DocumentName = (typeof DOCUMENT_NAMES)[number];
type JsonRecord = Record<string, unknown>;
type StaticQuestFetcher = (url: string) => Promise<unknown>;
export type StaticQuestFileMode = 'pvp' | 'pve';
export interface StaticQuestScoreQuest extends JsonRecord {
  english_name: string;
  finishable_here: boolean;
  gateway: boolean;
  id: string;
  label: string | null;
  off_goal: boolean;
}
export interface StaticQuestMapScore extends JsonRecord {
  english_name: string;
  finishable_here: boolean;
  gateway: boolean;
  id: string;
  off_goal: boolean;
  quests: StaticQuestScoreQuest[];
  score: number | null;
}
type StaticQuestProgress = Pick<UserProgressData, 'taskCompletions' | 'taskObjectives'> & {
  activeTaskIds: string[];
  confirmedTaskIds: string[];
};
export interface StaticQuestHydration {
  fileMode: StaticQuestFileMode;
  metadata: TarkovDataQueryResult;
  mode: GameMode;
  progress: StaticQuestProgress;
  scores: StaticQuestMapScore[];
}
interface StaticMetadataStore {
  confirmedStaticTaskIds: string[];
  confirmedStaticUnlockedTaskIds: string[];
  currentGameMode: string;
  error: Error | null;
  initialized: boolean;
  initializationFailed: boolean;
  loadStaticMapData: () => Promise<void>;
  processTasksData: (data: TarkovDataQueryResult) => void;
  staticMapScores: StaticQuestMapScore[];
  staticQuestFileMode: StaticQuestFileMode | null;
  tasksObjectivesHydrated: boolean;
  tasksObjectivesPending: boolean;
}
interface StaticProgressStore {
  $patch: (patcher: (state: UserState) => void) => void;
}
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const requireString = (value: unknown, description: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[StaticQuest] ${description} must be a non-empty string`);
  }
  return value;
};
const requireBoolean = (value: unknown, description: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`[StaticQuest] ${description} must be a boolean`);
  }
  return value;
};
const assertDocumentHeader = (
  value: unknown,
  name: DocumentName,
  mode: StaticQuestFileMode
): JsonRecord => {
  if (!isRecord(value)) {
    throw new Error(`[StaticQuest] ${name}.${mode}.json must contain an object`);
  }
  if (value.schema_version !== STATIC_QUEST_SCHEMA_VERSION) {
    throw new Error(
      `[StaticQuest] ${name}.${mode}.json has unsupported schema_version ${String(value.schema_version)}`
    );
  }
  if (value.mode !== mode) {
    throw new Error(`[StaticQuest] ${name}.${mode}.json declares mode ${String(value.mode)}`);
  }
  return value;
};
const requireRecordField = (value: JsonRecord, field: string, document: string): JsonRecord => {
  const candidate = value[field];
  if (!isRecord(candidate)) {
    throw new Error(`[StaticQuest] ${document} is missing object field ${field}`);
  }
  return candidate;
};
const requireArrayField = (value: JsonRecord, field: string, document: string): unknown[] => {
  const candidate = value[field];
  if (!Array.isArray(candidate)) {
    throw new Error(`[StaticQuest] ${document} is missing array field ${field}`);
  }
  return candidate;
};
const normalizedName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const namedItem = (value: unknown): TarkovItem => {
  if (!isRecord(value)) {
    throw new Error('[StaticQuest] task item must contain an object');
  }
  const id = requireString(value.id, 'task item id');
  const name = typeof value.english_name === 'string' ? value.english_name : id;
  return { id, name, normalizedName: normalizedName(name) };
};
const shapeZone = (value: unknown): NonNullable<TaskObjective['zones']>[number] => {
  if (!isRecord(value)) {
    throw new Error('[StaticQuest] objective zone must contain an object');
  }
  const mapId = requireString(value.map_id, 'objective zone map_id');
  const sourceMapId = requireString(value.map, 'objective zone map');
  return {
    ...value,
    map: { id: mapId },
    map_id: mapId,
    sourceMapId,
  } as NonNullable<TaskObjective['zones']>[number];
};
const shapeObjective = (value: unknown): TaskObjective => {
  if (!isRecord(value)) {
    throw new Error('[StaticQuest] task objective must contain an object');
  }
  const id = requireString(value.id, 'task objective id');
  const mapIds = requireArrayField(value, 'map_ids', `objective ${id}`).map((mapId) =>
    requireString(mapId, `objective ${id} map id`)
  );
  const items = requireArrayField(value, 'required_items', `objective ${id}`).map(namedItem);
  return {
    id,
    description: typeof value.english_description === 'string' ? value.english_description : id,
    item: items[0],
    items,
    maps: mapIds.map((mapId) => ({ id: mapId })),
    optional: value.optional === true,
    type: typeof value.type === 'string' ? value.type : undefined,
    zones: requireArrayField(value, 'zones', `objective ${id}`).map(shapeZone),
  };
};
const shapeTask = (key: string, value: unknown): Task => {
  if (!isRecord(value)) {
    throw new Error(`[StaticQuest] task ${key} must contain an object`);
  }
  const id = requireString(value.id, `task ${key} id`);
  if (id !== key) {
    throw new Error(`[StaticQuest] task ${key} declares mismatched id ${id}`);
  }
  const trader = requireRecordField(value, 'trader', `task ${id}`);
  const traderId = requireString(trader.id, `task ${id} trader id`);
  const traderName = typeof trader.english_name === 'string' ? trader.english_name : traderId;
  const mapIds = requireArrayField(value, 'map_ids', `task ${id}`).map((mapId) =>
    requireString(mapId, `task ${id} map id`)
  );
  return {
    id,
    map: mapIds[0] ? { id: mapIds[0] } : undefined,
    name: typeof value.english_name === 'string' ? value.english_name : id,
    objectives: requireArrayField(value, 'objectives', `task ${id}`).map(shapeObjective),
    requiredKeys: requireArrayField(value, 'required_keys', `task ${id}`).map((requirement) => {
      if (!isRecord(requirement)) {
        throw new Error(`[StaticQuest] task ${id} required key group is invalid`);
      }
      const requirementMapId = requireString(requirement.map_id, `task ${id} required key map_id`);
      return {
        keys: requireArrayField(requirement, 'keys', `task ${id} required key group`).map(
          namedItem
        ),
        maps: [{ id: requirementMapId }],
      };
    }),
    trader: { id: traderId, name: traderName, normalizedName: normalizedName(traderName) },
  };
};
const shapeProgress = (quests: JsonRecord): StaticQuestProgress => {
  const taskCompletions: UserProgressData['taskCompletions'] = {};
  const taskObjectives: UserProgressData['taskObjectives'] = {};
  const activeTaskIds: string[] = [];
  for (const [questId, rawQuest] of Object.entries(quests)) {
    if (!isRecord(rawQuest)) {
      throw new Error(`[StaticQuest] quest state ${questId} is invalid`);
    }
    const id = requireString(rawQuest.id, `quest state ${questId} id`);
    if (id !== questId) {
      throw new Error(`[StaticQuest] quest state ${questId} declares mismatched id ${id}`);
    }
    const status = rawQuest.status;
    if (status !== 'active' && status !== 'completed' && status !== 'failed') {
      throw new Error(
        `[StaticQuest] quest state ${questId} has unsupported status ${String(status)}`
      );
    }
    taskCompletions[questId] = {
      complete: status === 'completed',
      failed: status === 'failed',
    };
    if (status === 'active') activeTaskIds.push(questId);
    for (const objective of requireArrayField(rawQuest, 'objectives', `quest state ${questId}`)) {
      if (!isRecord(objective)) {
        throw new Error(`[StaticQuest] quest state ${questId} has an invalid objective`);
      }
      const objectiveId = requireString(objective.id, `quest state ${questId} objective id`);
      taskObjectives[objectiveId] = { complete: objective.completed === true };
    }
  }
  return {
    activeTaskIds,
    confirmedTaskIds: Object.keys(quests),
    taskCompletions,
    taskObjectives,
  };
};
const shapeScoreQuest = (value: unknown, mapId: string): StaticQuestScoreQuest => {
  if (!isRecord(value)) {
    throw new Error(`[StaticQuest] score map ${mapId} quest must contain an object`);
  }
  const id = requireString(value.id, `score map ${mapId} quest id`);
  return {
    ...value,
    english_name: typeof value.english_name === 'string' ? value.english_name : id,
    finishable_here: requireBoolean(
      value.finishable_here,
      `score map ${mapId} quest ${id} finishable_here`
    ),
    gateway: requireBoolean(value.gateway, `score map ${mapId} quest ${id} gateway`),
    id,
    label: typeof value.label === 'string' ? value.label : null,
    off_goal: requireBoolean(value.off_goal, `score map ${mapId} quest ${id} off_goal`),
  };
};
const shapeScores = (values: unknown[]): StaticQuestMapScore[] =>
  values.map((value) => {
    if (!isRecord(value)) {
      throw new Error('[StaticQuest] score map must contain an object');
    }
    const id = requireString(value.id, 'score map id');
    if (value.score !== null && typeof value.score !== 'number') {
      throw new Error(`[StaticQuest] score map ${id} score must be a number or null`);
    }
    return {
      ...value,
      english_name: typeof value.english_name === 'string' ? value.english_name : id,
      finishable_here: requireBoolean(value.finishable_here, `score map ${id} finishable_here`),
      gateway: requireBoolean(value.gateway, `score map ${id} gateway`),
      id,
      off_goal: requireBoolean(value.off_goal, `score map ${id} off_goal`),
      quests: requireArrayField(value, 'quests', `score map ${id}`).map((quest) =>
        shapeScoreQuest(quest, id)
      ),
      score: value.score,
    };
  });
const shapeMetadata = (tasks: JsonRecord, scores: StaticQuestMapScore[]): TarkovDataQueryResult => {
  const shapedTasks = Object.entries(tasks).map(([id, task]) => shapeTask(id, task));
  const scoreNames = new Map(scores.map((score) => [score.id, score.english_name]));
  const mapIds = new Set(scores.map((score) => score.id));
  const traders = new Map<string, { id: string; name: string; normalizedName: string }>();
  for (const task of shapedTasks) {
    if (task.map?.id) mapIds.add(task.map.id);
    if (task.trader?.id) {
      const traderName = task.trader.name ?? task.trader.id;
      traders.set(task.trader.id, {
        id: task.trader.id,
        name: traderName,
        normalizedName: task.trader.normalizedName ?? normalizedName(traderName),
      });
    }
    for (const objective of task.objectives ?? []) {
      for (const map of objective.maps ?? []) mapIds.add(map.id);
      for (const zone of objective.zones ?? []) if (zone.map?.id) mapIds.add(zone.map.id);
    }
    for (const requirement of task.requiredKeys ?? []) {
      for (const map of requirement.maps ?? []) mapIds.add(map.id);
    }
  }
  return {
    maps: [...mapIds].map((id) => ({
      id,
      name: scoreNames.get(id) ?? id,
      normalizedName: id,
    })),
    tasks: shapedTasks,
    traders: [...traders.values()],
  };
};
export const resolveStaticQuestFileMode = (mode: GameMode): StaticQuestFileMode =>
  mode === GAME_MODES.PVE ? 'pve' : 'pvp';
export const normalizeStaticQuestBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim() || DEFAULT_STATIC_QUEST_BASE_URL;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('[StaticQuest] data base URL must use HTTP or HTTPS');
    }
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/+$/, '');
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return path.replace(/\/+$/, '') || DEFAULT_STATIC_QUEST_BASE_URL;
};
export const buildStaticQuestUrl = (
  baseUrl: string,
  name: DocumentName,
  mode: StaticQuestFileMode
): string => `${normalizeStaticQuestBaseUrl(baseUrl)}/${name}.${mode}.json`;
export const isStaticQuestModeEnabled = (): boolean =>
  useRuntimeConfig().public.staticQuestMode === true;
export const loadStaticQuestHydration = async (
  baseUrl: string,
  mode: GameMode,
  fetcher: StaticQuestFetcher
): Promise<StaticQuestHydration> => {
  const fileMode = resolveStaticQuestFileMode(mode);
  const [tasksValue, stateValue, scoresValue] = await Promise.all(
    DOCUMENT_NAMES.map((name) => fetcher(buildStaticQuestUrl(baseUrl, name, fileMode)))
  );
  const tasksDocument = assertDocumentHeader(tasksValue, 'tasks', fileMode);
  const stateDocument = assertDocumentHeader(stateValue, 'state', fileMode);
  const scoresDocument = assertDocumentHeader(scoresValue, 'scores', fileMode);
  const tasks = requireRecordField(tasksDocument, 'tasks', `tasks.${fileMode}.json`);
  const quests = requireRecordField(stateDocument, 'quests', `state.${fileMode}.json`);
  const scores = shapeScores(requireArrayField(scoresDocument, 'maps', `scores.${fileMode}.json`));
  return {
    fileMode,
    metadata: shapeMetadata(tasks, scores),
    mode,
    progress: shapeProgress(quests),
    scores,
  };
};
export const applyStaticQuestHydration = async (
  hydration: StaticQuestHydration,
  metadataStore: StaticMetadataStore,
  progressStore: StaticProgressStore,
  shouldApply: () => boolean = () => true
): Promise<boolean> => {
  await metadataStore.loadStaticMapData();
  if (!shouldApply()) return false;
  metadataStore.processTasksData(hydration.metadata);
  metadataStore.confirmedStaticTaskIds = hydration.progress.confirmedTaskIds;
  metadataStore.confirmedStaticUnlockedTaskIds = hydration.progress.activeTaskIds;
  metadataStore.currentGameMode = hydration.mode;
  metadataStore.staticMapScores = hydration.scores;
  metadataStore.staticQuestFileMode = hydration.fileMode;
  metadataStore.tasksObjectivesHydrated = true;
  metadataStore.tasksObjectivesPending = false;
  metadataStore.error = null;
  metadataStore.initialized = true;
  metadataStore.initializationFailed = false;
  progressStore.$patch((state) => {
    state.currentGameMode = hydration.mode;
    state[hydration.mode] = {
      ...state[hydration.mode],
      taskCompletions: hydration.progress.taskCompletions,
      taskObjectives: hydration.progress.taskObjectives,
    };
  });
  return true;
};
export const createStaticQuestHydrator = (
  load: (mode: GameMode) => Promise<StaticQuestHydration>,
  apply: (hydration: StaticQuestHydration, isLatest: () => boolean) => Promise<boolean>
) => {
  let latestRequest = 0;
  return async (mode: GameMode): Promise<boolean> => {
    const request = ++latestRequest;
    let hydration: StaticQuestHydration;
    try {
      hydration = await load(mode);
    } catch (error) {
      if (request !== latestRequest) return false;
      throw error;
    }
    if (request !== latestRequest) return false;
    const applied = await apply(hydration, () => request === latestRequest);
    return applied && request === latestRequest;
  };
};
export const isStaticQuestMode = (value: unknown): value is GameMode =>
  value === GAME_MODES.PVP || value === GAME_MODES.PVE || value === GAME_MODES.SEASONAL;

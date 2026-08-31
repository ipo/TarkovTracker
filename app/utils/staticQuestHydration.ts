import { GAME_MODES, type GameMode } from '@/utils/constants';
import type { UserProgressData, UserState } from '@/stores/progressState';
import type { TarkovDataQueryResult, TarkovItem, Task, TaskObjective } from '@/types/tarkov';
const STATIC_QUEST_SCHEMA_VERSION = 1;
const DOCUMENT_NAMES = ['tasks', 'state', 'scores'] as const;
type DocumentName = (typeof DOCUMENT_NAMES)[number];
type JsonRecord = Record<string, unknown>;
type StaticQuestFetcher = (url: string) => Promise<unknown>;
interface StaticScoresDocument extends JsonRecord {
  maps: Array<{
    english_name: string;
    id: string;
    score: unknown;
  }>;
  mode: GameMode;
  schema_version: number;
}
export interface StaticQuestHydration {
  metadata: TarkovDataQueryResult;
  mode: GameMode;
  progress: Pick<UserProgressData, 'taskCompletions' | 'taskObjectives'>;
  scores: StaticScoresDocument['maps'];
}
interface StaticMetadataStore {
  currentGameMode: string;
  error: Error | null;
  initialized: boolean;
  initializationFailed: boolean;
  loading: boolean;
  loadStaticMapData: () => Promise<void>;
  processTasksData: (data: TarkovDataQueryResult) => void;
  tasksObjectivesHydrated: boolean;
  tasksObjectivesPending: boolean;
}
interface StaticProgressStore {
  $patch: (patcher: (state: UserState) => void) => void;
}
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const assertDocumentHeader = (value: unknown, name: DocumentName, mode: GameMode): JsonRecord => {
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
const namedItem = (value: unknown): TarkovItem => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('[StaticQuest] task item must have a string id');
  }
  return {
    id: value.id,
    name: typeof value.english_name === 'string' ? value.english_name : value.id,
  };
};
const shapeZone = (value: unknown): NonNullable<TaskObjective['zones']>[number] => {
  if (!isRecord(value) || typeof value.map_id !== 'string') {
    throw new Error('[StaticQuest] objective zone must have a string map_id');
  }
  const zone: NonNullable<TaskObjective['zones']>[number] = {
    map: { id: value.map_id },
  };
  if (isRecord(value.position)) {
    const { x, y, z } = value.position;
    if ([x, y, z].every((coordinate) => typeof coordinate === 'number')) {
      zone.position = { x: x as number, y: y as number, z: z as number };
    }
  }
  if (Array.isArray(value.outline)) {
    zone.outline = value.outline.flatMap((point) => {
      if (!isRecord(point)) return [];
      const { x, y, z } = point;
      return [x, y, z].every((coordinate) => typeof coordinate === 'number')
        ? [{ x: x as number, y: y as number, z: z as number }]
        : [];
    });
  }
  return zone;
};
const shapeObjective = (value: unknown): TaskObjective => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('[StaticQuest] task objective must have a string id');
  }
  const mapIds = requireArrayField(value, 'map_ids', `objective ${value.id}`).map(String);
  return {
    id: value.id,
    description:
      typeof value.english_description === 'string' ? value.english_description : value.id,
    items: requireArrayField(value, 'required_items', `objective ${value.id}`).map(namedItem),
    maps: mapIds.map((id) => ({ id })),
    optional: value.optional === true,
    type: typeof value.type === 'string' ? value.type : undefined,
    zones: requireArrayField(value, 'zones', `objective ${value.id}`).map(shapeZone),
  };
};
const shapeTask = (value: unknown): Task => {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('[StaticQuest] task must have a string id');
  }
  const trader = requireRecordField(value, 'trader', `task ${value.id}`);
  if (typeof trader.id !== 'string') {
    throw new Error(`[StaticQuest] task ${value.id} trader must have a string id`);
  }
  const mapIds = requireArrayField(value, 'map_ids', `task ${value.id}`).map(String);
  return {
    id: value.id,
    map: mapIds[0] ? { id: mapIds[0] } : undefined,
    name: typeof value.english_name === 'string' ? value.english_name : value.id,
    objectives: requireArrayField(value, 'objectives', `task ${value.id}`).map(shapeObjective),
    requiredKeys: requireArrayField(value, 'required_keys', `task ${value.id}`).map(
      (requirement) => {
        if (!isRecord(requirement) || typeof requirement.map_id !== 'string') {
          throw new Error(`[StaticQuest] task ${value.id} required key group is invalid`);
        }
        return {
          keys: requireArrayField(requirement, 'keys', `task ${value.id} required key group`).map(
            namedItem
          ),
          maps: [{ id: requirement.map_id }],
        };
      }
    ),
    trader: {
      id: trader.id,
      name: typeof trader.english_name === 'string' ? trader.english_name : trader.id,
    },
  };
};
const shapeProgress = (
  quests: JsonRecord
): Pick<UserProgressData, 'taskCompletions' | 'taskObjectives'> => {
  const taskCompletions: UserProgressData['taskCompletions'] = {};
  const taskObjectives: UserProgressData['taskObjectives'] = {};
  for (const [questId, rawQuest] of Object.entries(quests)) {
    if (!isRecord(rawQuest) || typeof rawQuest.id !== 'string') {
      throw new Error(`[StaticQuest] quest state ${questId} is invalid`);
    }
    const status = rawQuest.status;
    if (status !== 'active' && status !== 'completed' && status !== 'failed') {
      throw new Error(
        `[StaticQuest] quest state ${questId} has unsupported status ${String(status)}`
      );
    }
    taskCompletions[questId] = {
      complete: status !== 'active',
      failed: status === 'failed',
    };
    for (const objective of requireArrayField(rawQuest, 'objectives', `quest state ${questId}`)) {
      if (!isRecord(objective) || typeof objective.id !== 'string') {
        throw new Error(`[StaticQuest] quest state ${questId} has an invalid objective`);
      }
      taskObjectives[objective.id] = { complete: objective.completed === true };
    }
  }
  return { taskCompletions, taskObjectives };
};
const shapeMetadata = (tasks: JsonRecord, scores: unknown[]): TarkovDataQueryResult => {
  const shapedTasks = Object.values(tasks).map(shapeTask);
  const scoreNames = new Map<string, string>();
  for (const score of scores) {
    if (!isRecord(score) || typeof score.id !== 'string') {
      throw new Error('[StaticQuest] score map must have a string id');
    }
    scoreNames.set(
      score.id,
      typeof score.english_name === 'string' ? score.english_name : score.id
    );
  }
  const mapIds = new Set<string>();
  const traders = new Map<string, { id: string; name: string }>();
  for (const task of shapedTasks) {
    if (task.map?.id) mapIds.add(task.map.id);
    if (task.trader?.id) {
      traders.set(task.trader.id, { id: task.trader.id, name: task.trader.name ?? task.trader.id });
    }
    for (const objective of task.objectives ?? []) {
      for (const map of objective.maps ?? []) mapIds.add(map.id);
      for (const zone of objective.zones ?? []) {
        if (zone.map?.id) mapIds.add(zone.map.id);
      }
    }
    for (const requirement of task.requiredKeys ?? []) {
      for (const map of requirement.maps ?? []) mapIds.add(map.id);
    }
  }
  return {
    maps: [...mapIds].sort().map((id) => ({
      id,
      name: scoreNames.get(id) ?? id,
      normalizedName: id,
    })),
    tasks: shapedTasks,
    traders: [...traders.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
};
export const buildStaticQuestUrl = (baseUrl: string, name: DocumentName, mode: GameMode): string =>
  `${baseUrl.trim().replace(/\/+$/, '')}/${name}.${mode}.json`;
export const loadStaticQuestHydration = async (
  baseUrl: string,
  mode: GameMode,
  fetcher: StaticQuestFetcher
): Promise<StaticQuestHydration> => {
  const [tasksValue, stateValue, scoresValue] = await Promise.all(
    DOCUMENT_NAMES.map((name) => fetcher(buildStaticQuestUrl(baseUrl, name, mode)))
  );
  const tasksDocument = assertDocumentHeader(tasksValue, 'tasks', mode);
  const stateDocument = assertDocumentHeader(stateValue, 'state', mode);
  const scoresDocument = assertDocumentHeader(scoresValue, 'scores', mode);
  const tasks = requireRecordField(tasksDocument, 'tasks', `tasks.${mode}.json`);
  const quests = requireRecordField(stateDocument, 'quests', `state.${mode}.json`);
  const scores = requireArrayField(scoresDocument, 'maps', `scores.${mode}.json`);
  return {
    metadata: shapeMetadata(tasks, scores),
    mode,
    progress: shapeProgress(quests),
    scores: scores as StaticScoresDocument['maps'],
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
  metadataStore.currentGameMode = hydration.mode;
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
  apply: (hydration: StaticQuestHydration, isLatest: () => boolean) => Promise<unknown>
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
    await apply(hydration, () => request === latestRequest);
    return request === latestRequest;
  };
};
export const isStaticQuestMode = (value: unknown): value is GameMode =>
  value === GAME_MODES.PVP || value === GAME_MODES.PVE || value === GAME_MODES.SEASONAL;

export const STATIC_QUEST_SCHEMA_VERSION = 1;
export const DEFAULT_STATIC_QUEST_DATA_BASE_URL = '/quest-data';
export const STATIC_QUEST_OUTPUT_NAMES = ['tasks', 'state', 'scores'] as const;
export const STATIC_QUEST_FILE_MODES = ['pvp', 'pve'] as const;
export const CONFIRMED_QUEST_STATUSES = ['active', 'completed', 'failed'] as const;
export type StaticQuestOutputName = (typeof STATIC_QUEST_OUTPUT_NAMES)[number];
export type StaticQuestFileMode = (typeof STATIC_QUEST_FILE_MODES)[number];
export type ConfirmedQuestStatus = (typeof CONFIRMED_QUEST_STATUSES)[number];
export type StaticQuestNamedRef = {
  id: string;
  english_name: string;
};
export type StaticQuestZone = {
  id: string;
  map: string;
  map_id: string;
  name?: string;
  position?: { x: number; y: number; z: number };
  size?: { x: number; y: number; z: number };
  outline?: Array<{ x: number; y: number; z: number }>;
  top?: number;
  bottom?: number;
  terrainElevation?: number;
  [key: string]: unknown;
};
export type StaticQuestObjective = {
  id: string;
  english_description: string;
  type: string;
  optional: boolean;
  map_ids: string[];
  required_items: StaticQuestNamedRef[];
  zones: StaticQuestZone[];
};
export type StaticQuestTask = {
  id: string;
  english_name: string;
  trader: StaticQuestNamedRef;
  map_ids: string[];
  required_keys: Array<{ map_id: string; keys: StaticQuestNamedRef[] }>;
  objectives: StaticQuestObjective[];
};
export type StaticQuestObjectiveStatus = {
  id: string;
  optional?: boolean;
  required?: boolean;
  completed?: boolean;
  pending?: boolean;
};
export type StaticQuestStateEntry = {
  id: string;
  status: ConfirmedQuestStatus;
  objectives: StaticQuestObjectiveStatus[];
};
export type StaticQuestScoreQuest = {
  id: string;
  english_name: string;
  label?: string | null;
  gateway: boolean;
  off_goal: boolean;
  finishable_here: boolean;
};
export type StaticQuestScoreMap = {
  id: string;
  english_name: string;
  score: number | null;
  gateway: boolean;
  off_goal: boolean;
  finishable_here: boolean;
  quests: StaticQuestScoreQuest[];
};
export type StaticQuestTasksDocument = {
  mode: StaticQuestFileMode;
  schema_version: number;
  tasks: Record<string, StaticQuestTask>;
};
export type StaticQuestStateDocument = {
  mode: StaticQuestFileMode;
  schema_version: number;
  quests: Record<string, StaticQuestStateEntry>;
};
export type StaticQuestScoresDocument = {
  mode: StaticQuestFileMode;
  schema_version: number;
  maps: StaticQuestScoreMap[];
};
export type StaticQuestBundle = {
  tasks: StaticQuestTasksDocument;
  state: StaticQuestStateDocument;
  scores: StaticQuestScoresDocument;
};
export type StaticQuestDataConfig = {
  enabled: boolean;
  baseUrl: string;
};

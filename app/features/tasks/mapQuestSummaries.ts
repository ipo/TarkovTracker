import type { Task, TarkovMap } from '@/types/tarkov';
import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
export interface QuestSummary {
  bring: string[];
  name: string;
  questId: string;
  summary: string;
}
export interface MapQuestSummary {
  bring: string[];
  id: string;
  name: string;
  objectives: string[];
  summary: string | null;
}
interface QuestSummaryDocument {
  bring: unknown;
  name: unknown;
  quest_id: unknown;
  summary: unknown;
}
const isQuestSummaryDocument = (value: unknown): value is QuestSummaryDocument =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'quest_id' in value;
export const parseQuestSummaries = (value: string): Map<string, QuestSummary> => {
  const summaries = new Map<string, QuestSummary>();
  for (const [index, line] of value.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const parsed: unknown = JSON.parse(line);
    if (
      !isQuestSummaryDocument(parsed) ||
      typeof parsed.quest_id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.bring) ||
      !parsed.bring.every((item) => typeof item === 'string')
    ) {
      throw new Error(`Quest summary line ${index + 1} is invalid`);
    }
    summaries.set(parsed.quest_id, {
      bring: parsed.bring,
      name: parsed.name,
      questId: parsed.quest_id,
      summary: parsed.summary,
    });
  }
  return summaries;
};
export const buildMapQuestSummaries = (
  map: Pick<TarkovMap, 'id' | 'mergedIds'> | undefined,
  scores: StaticQuestMapScore[],
  tasks: Task[],
  summaries: Map<string, QuestSummary>
): MapQuestSummary[] => {
  if (!map) return [];
  const mapIds = new Set([map.id, ...(map.mergedIds ?? [])]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const seenQuestIds = new Set<string>();
  const quests = scores
    .filter((score) => mapIds.has(score.id))
    .flatMap((score) => score.quests)
    .filter((quest) => {
      if (seenQuestIds.has(quest.id)) return false;
      seenQuestIds.add(quest.id);
      return true;
    });
  return quests.map((quest) => {
    const task = taskById.get(quest.id);
    const summary = summaries.get(quest.id);
    return {
      bring: summary?.bring ?? [],
      id: quest.id,
      name: task?.name ?? summary?.name ?? quest.english_name,
      objectives: summary
        ? []
        : (task?.objectives ?? [])
            .map((objective) => objective.description)
            .filter((description): description is string => typeof description === 'string'),
      summary: summary?.summary ?? null,
    };
  });
};
export const collectMapQuestBringItems = (quests: MapQuestSummary[]): string[] =>
  quests.flatMap((quest) => quest.bring);

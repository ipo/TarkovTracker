import type { MapMark, MapMarkLocation, MapZone } from '@/features/maps/utils/marksHash';
import type { Task, TaskObjective } from '@/types/tarkov';
import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
interface StaticObjectiveMarksOptions {
  activeTaskIds: readonly string[];
  isObjectiveComplete: (objectiveId: string) => boolean;
  mapId: string | null | undefined;
  scores: StaticQuestMapScore[];
  tasks: Task[];
}
const getObjectiveGeometry = (
  objective: TaskObjective,
  mapId: string
): { possibleLocations: MapMarkLocation[]; zones: MapZone[] } => {
  const possibleLocations: MapMarkLocation[] = [];
  const zones: MapZone[] = [];
  for (const zone of objective.zones ?? []) {
    if (zone.map?.id !== mapId) continue;
    const outline = (zone.outline ?? []).map(({ x, z }) => ({ x, z }));
    if (outline.length >= 3) {
      zones.push({ map: { id: mapId }, outline });
    } else if (zone.position) {
      possibleLocations.push({
        map: { id: mapId },
        positions: [zone.position],
      });
    }
  }
  for (const location of objective.possibleLocations ?? []) {
    if (location.map?.id !== mapId || !location.positions?.length) continue;
    possibleLocations.push({
      map: { id: mapId },
      positions: location.positions,
    });
  }
  return { possibleLocations, zones };
};
export const buildStaticObjectiveMarks = ({
  activeTaskIds,
  isObjectiveComplete,
  mapId,
  scores,
  tasks,
}: StaticObjectiveMarksOptions): MapMark[] => {
  if (!mapId) return [];
  const activeTasks = new Set(activeTaskIds);
  const mapScore = scores.find((score) => score.id === mapId);
  const plannedTasks = new Set(mapScore?.quests.map((quest) => quest.id) ?? []);
  const marks: MapMark[] = [];
  for (const task of tasks) {
    if (!activeTasks.has(task.id)) continue;
    if (plannedTasks.size > 0 && !plannedTasks.has(task.id)) continue;
    const score = mapScore?.quests.find((quest) => quest.id === task.id);
    for (const objective of task.objectives ?? []) {
      if (isObjectiveComplete(objective.id)) continue;
      const geometry = getObjectiveGeometry(objective, mapId);
      if (geometry.zones.length === 0 && geometry.possibleLocations.length === 0) continue;
      marks.push({
        id: objective.id,
        possibleLocations: geometry.possibleLocations,
        recommendation: score
          ? {
              finishableHere: score.finishable_here,
              gateway: score.gateway,
              offGoal: score.off_goal,
            }
          : undefined,
        users: ['self'],
        zones: geometry.zones,
      });
    }
  }
  return marks;
};

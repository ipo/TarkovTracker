import {
  createGraph,
  getChildren,
  getParents,
  getPredecessors,
  getSuccessors,
  safeAddEdge,
  safeAddNode,
} from '@/utils/graphHelpers';
import { normalizeTaskObjectives } from '@/utils/taskNormalization';
import type {
  HideoutStation,
  ObjectiveGPSInfo,
  ObjectiveMapInfo,
  Task,
  TaskObjective,
} from '@/types/tarkov';
export function useGraphBuilder() {
  const processTaskData = (taskList: Task[]) => {
    const taskGraph = createGraph();
    const objectiveMaps: Record<string, ObjectiveMapInfo[]> = {};
    const objectiveGPS: Record<string, ObjectiveGPSInfo[]> = {};
    const mapTasks: Record<string, string[]> = {};
    for (const task of taskList) {
      safeAddNode(taskGraph, task.id);
      for (const requirement of task.taskRequirements ?? []) {
        if (
          !requirement.task?.id ||
          !taskList.some((candidate) => candidate.id === requirement.task?.id)
        )
          continue;
        safeAddEdge(taskGraph, requirement.task.id, task.id);
      }
      for (const objective of normalizeTaskObjectives<TaskObjective>(task.objectives)) {
        if (!objective.location?.id) continue;
        const mapId = String(objective.location.id);
        (mapTasks[mapId] ??= []).push(task.id);
        (objectiveMaps[task.id] ??= []).push({ mapID: mapId, objectiveID: String(objective.id) });
        if (objective.x !== undefined && objective.y !== undefined) {
          (objectiveGPS[task.id] ??= []).push({
            objectiveID: objective.id,
            x: objective.x,
            y: objective.y,
          });
        }
      }
    }
    return {
      tasks: taskList.map((task) => ({
        ...task,
        children: getChildren(taskGraph, task.id),
        parents: getParents(taskGraph, task.id),
        predecessors: getPredecessors(taskGraph, task.id),
        successors: getSuccessors(taskGraph, task.id),
      })),
      taskGraph,
      mapTasks,
      objectiveMaps,
      objectiveGPS,
      alternativeTasks: {},
      neededItemTaskObjectives: [],
    };
  };
  const processHideoutData = (_stations: HideoutStation[]) => ({
    hideoutGraph: createGraph(),
    hideoutModules: [],
    neededItemHideoutModules: [],
  });
  return { processTaskData, processHideoutData };
}

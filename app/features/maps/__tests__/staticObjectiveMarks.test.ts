import { describe, expect, it } from 'vitest';
import { buildStaticObjectiveMarks } from '@/features/maps/staticObjectiveMarks';
import type { Task } from '@/types/tarkov';
import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
const task = (id: string, objectiveId: string, mapId: string): Task => ({
  id,
  objectives: [
    {
      id: objectiveId,
      zones: [
        {
          map: { id: mapId },
          outline: [
            { x: 1, y: 0, z: 1 },
            { x: 2, y: 0, z: 1 },
            { x: 2, y: 0, z: 2 },
          ],
        },
      ],
    },
  ],
});
const score = (taskId: string): StaticQuestMapScore => ({
  english_name: 'Woods',
  finishable_here: true,
  gateway: true,
  id: 'woods',
  off_goal: false,
  quests: [
    {
      english_name: 'Planned task',
      finishable_here: true,
      gateway: true,
      id: taskId,
      label: 'gateway',
      off_goal: false,
    },
  ],
  score: 42,
});
describe('buildStaticObjectiveMarks', () => {
  it('renders incomplete zoned objectives for active tasks in the selected map plan', () => {
    const tasks = [task('planned', 'planned-objective', 'woods'), task('other', 'other', 'woods')];
    const marks = buildStaticObjectiveMarks({
      activeTaskIds: ['planned', 'other'],
      isObjectiveComplete: () => false,
      mapId: 'woods',
      scores: [score('planned')],
      tasks,
    });
    expect(marks).toEqual([
      expect.objectContaining({
        id: 'planned-objective',
        recommendation: { finishableHere: true, gateway: true, offGoal: false },
        users: ['self'],
      }),
    ]);
    expect(marks[0]?.zones).toHaveLength(1);
  });
  it('excludes completed objectives and tasks absent from confirmed active state', () => {
    const tasks = [
      task('active', 'completed-objective', 'woods'),
      task('catalog-only', 'catalog-objective', 'woods'),
    ];
    const marks = buildStaticObjectiveMarks({
      activeTaskIds: ['active'],
      isObjectiveComplete: (objectiveId) => objectiveId === 'completed-objective',
      mapId: 'woods',
      scores: [],
      tasks,
    });
    expect(marks).toEqual([]);
  });
  it('uses a zone position when no polygon outline is available', () => {
    const tasks: Task[] = [
      {
        id: 'active',
        objectives: [
          {
            id: 'point-objective',
            zones: [{ map: { id: 'customs' }, position: { x: 10, y: 2, z: 20 } }],
          },
        ],
      },
    ];
    const marks = buildStaticObjectiveMarks({
      activeTaskIds: ['active'],
      isObjectiveComplete: () => false,
      mapId: 'customs',
      scores: [],
      tasks,
    });
    expect(marks[0]?.possibleLocations).toEqual([
      { map: { id: 'customs' }, positions: [{ x: 10, y: 2, z: 20 }] },
    ]);
  });
});

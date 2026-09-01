import { describe, expect, it } from 'vitest';
import {
  buildMapQuestSummaries,
  collectMapQuestBringItems,
  parseQuestSummaries,
} from '@/features/tasks/mapQuestSummaries';
import type { Task } from '@/types/tarkov';
import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
const score = (id: string, questIds: string[]): StaticQuestMapScore => ({
  english_name: id,
  finishable_here: false,
  gateway: false,
  id,
  off_goal: false,
  quests: questIds.map((questId) => ({
    english_name: `Score ${questId}`,
    finishable_here: false,
    gateway: false,
    id: questId,
    label: null,
    off_goal: false,
  })),
  score: 1,
});
const tasks = [
  {
    id: 'quest-1',
    name: 'Quest One',
    objectives: [{ id: 'objective-1', description: 'Fallback objective' }],
  },
  {
    id: 'quest-2',
    name: 'Quest Two',
    objectives: [{ id: 'objective-2', description: 'Second fallback' }],
  },
] as Task[];
describe('map quest summaries', () => {
  it('parses JSONL summaries and rejects malformed records', () => {
    const summaries = parseQuestSummaries(
      '{"quest_id":"quest-1","name":"Quest One","summary":"Do the thing.","bring":["Key"]}\n'
    );
    expect(summaries.get('quest-1')).toEqual({
      bring: ['Key'],
      name: 'Quest One',
      questId: 'quest-1',
      summary: 'Do the thing.',
    });
    expect(() => parseQuestSummaries('{"quest_id":"quest-1","bring":[]}')).toThrow(
      'Quest summary line 1 is invalid'
    );
  });
  it('uses summaries and falls back to task objectives for missing summaries', () => {
    const summaries = parseQuestSummaries(
      '{"quest_id":"quest-1","name":"Quest One","summary":"Do the thing.","bring":["Key"]}'
    );
    expect(
      buildMapQuestSummaries(
        { id: 'woods' },
        [score('woods', ['quest-1', 'quest-2'])],
        tasks,
        summaries
      )
    ).toEqual([
      {
        bring: ['Key'],
        id: 'quest-1',
        name: 'Quest One',
        objectives: [],
        summary: 'Do the thing.',
      },
      {
        bring: [],
        id: 'quest-2',
        name: 'Quest Two',
        objectives: ['Second fallback'],
        summary: null,
      },
    ]);
  });
  it('merges map aliases, removes duplicate quests, and preserves repeated bring items', () => {
    const summaries = parseQuestSummaries(
      [
        '{"quest_id":"quest-1","name":"Quest One","summary":"One.","bring":["Key"]}',
        '{"quest_id":"quest-2","name":"Quest Two","summary":"Two.","bring":["Key","Marker"]}',
      ].join('\n')
    );
    const quests = buildMapQuestSummaries(
      { id: 'factory', mergedIds: ['factory', 'night-factory'] },
      [score('factory', ['quest-1']), score('night-factory', ['quest-1', 'quest-2'])],
      tasks,
      summaries
    );
    expect(quests.map((quest) => quest.id)).toEqual(['quest-1', 'quest-2']);
    expect(collectMapQuestBringItems(quests)).toEqual(['Key', 'Key', 'Marker']);
  });
});

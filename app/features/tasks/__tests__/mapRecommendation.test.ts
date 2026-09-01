import { describe, expect, it } from 'vitest';
import {
  getMapRecommendationButtonStyle,
  getMapRecommendationRelevance,
  getMapRecommendationScore,
  sortMapsByRecommendation,
} from '@/features/tasks/mapRecommendation';
const scores = [
  { id: 'woods', score: 90 },
  { id: 'shoreline', score: 87 },
  { id: 'factory', score: 40 },
  { id: 'night-factory', score: 45 },
  { id: 'terminal', score: 0 },
];
describe('map recommendations', () => {
  it('sorts every map from highest score to lowest while leaving missing scores last', () => {
    const maps = [{ id: 'terminal' }, { id: 'missing' }, { id: 'shoreline' }, { id: 'woods' }];
    expect(sortMapsByRecommendation(maps, scores).map((map) => map.id)).toEqual([
      'woods',
      'shoreline',
      'terminal',
      'missing',
    ]);
  });
  it('uses the strongest score for map aliases sharing one selection button', () => {
    expect(
      getMapRecommendationScore({ id: 'factory', mergedIds: ['factory', 'night-factory'] }, scores)
    ).toBe(45);
  });
  it('normalizes scores continuously so nearby scores retain nearby relevance', () => {
    expect(getMapRecommendationRelevance({ id: 'woods' }, scores)).toBe(1);
    expect(getMapRecommendationRelevance({ id: 'shoreline' }, scores)).toBeCloseTo(87 / 90);
    expect(getMapRecommendationRelevance({ id: 'terminal' }, scores)).toBe(0);
  });
  it('generates stronger backgrounds for selected buttons without changing their score color', () => {
    const idle = getMapRecommendationButtonStyle({ id: 'woods' }, scores, false);
    const selected = getMapRecommendationButtonStyle({ id: 'woods' }, scores, true);
    expect(idle?.borderColor).toBe(selected?.borderColor);
    expect(idle?.backgroundColor).toContain('32%');
    expect(selected?.backgroundColor).toContain('72%');
  });
});

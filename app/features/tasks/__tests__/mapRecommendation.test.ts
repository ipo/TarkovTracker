import { describe, expect, it } from 'vitest';
import { getMapRecommendationTier } from '@/features/tasks/mapRecommendation';
describe('getMapRecommendationTier', () => {
  it('uses the first positive exporter score as primary and later scores as secondary', () => {
    const scores = [
      { id: 'ground-zero', score: 12.5 },
      { id: 'customs', score: 1 },
    ];
    expect(getMapRecommendationTier('ground-zero', scores)).toBe('primary');
    expect(getMapRecommendationTier('customs', scores)).toBe('secondary');
    expect(getMapRecommendationTier('woods', scores)).toBe('neutral');
  });
  it('keeps zero, null, and empty score documents neutral', () => {
    const scores = [
      { id: 'ground-zero', score: 0 },
      { id: 'customs', score: null },
    ];
    expect(getMapRecommendationTier('ground-zero', scores)).toBe('neutral');
    expect(getMapRecommendationTier('customs', scores)).toBe('neutral');
    expect(getMapRecommendationTier('woods', [])).toBe('neutral');
  });
});

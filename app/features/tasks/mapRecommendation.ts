import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
export type MapRecommendationTier = 'primary' | 'secondary' | 'neutral';
export const getMapRecommendationTier = (
  mapId: string,
  scores: Pick<StaticQuestMapScore, 'id' | 'score'>[]
): MapRecommendationTier => {
  const matchingScores = scores.filter(
    (score) => typeof score.score === 'number' && score.score > 0
  );
  if (matchingScores[0]?.id === mapId) return 'primary';
  return matchingScores.some((score) => score.id === mapId) ? 'secondary' : 'neutral';
};

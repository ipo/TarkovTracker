import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
export type MapRecommendationTier = 'primary' | 'secondary' | 'neutral';
type MapRecommendationScore = Pick<StaticQuestMapScore, 'id' | 'score'>;
const hasPositiveScore = (score: MapRecommendationScore): boolean =>
  typeof score.score === 'number' && Number.isFinite(score.score) && score.score > 0;
export const getMapRecommendationTier = (
  mapId: string,
  scores: MapRecommendationScore[]
): MapRecommendationTier => {
  const positiveScores = scores.filter(hasPositiveScore);
  if (positiveScores[0]?.id === mapId) return 'primary';
  return positiveScores.some((score) => score.id === mapId) ? 'secondary' : 'neutral';
};

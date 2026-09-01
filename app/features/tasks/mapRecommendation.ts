import type { StaticQuestMapScore } from '@/utils/staticQuestHydration';
type MapRecommendationScore = Pick<StaticQuestMapScore, 'id' | 'score'>;
interface MapRecommendationTarget {
  id: string;
  mergedIds?: string[];
}
const finiteScore = (value: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const targetIds = (target: MapRecommendationTarget): Set<string> =>
  new Set([target.id, ...(target.mergedIds ?? [])]);
export const getMapRecommendationScore = (
  target: MapRecommendationTarget,
  scores: MapRecommendationScore[]
): number | null => {
  const ids = targetIds(target);
  const matching = scores
    .filter((score) => ids.has(score.id) && finiteScore(score.score))
    .map((score) => score.score);
  return matching.length > 0 ? Math.max(...matching) : null;
};
export const getMapRecommendationRelevance = (
  target: MapRecommendationTarget,
  scores: MapRecommendationScore[]
): number | null => {
  const score = getMapRecommendationScore(target, scores);
  if (score === null) return null;
  const values = scores.map((entry) => entry.score).filter(finiteScore);
  if (values.length === 0) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return maximum > 0 ? 1 : 0;
  return (score - minimum) / (maximum - minimum);
};
export const sortMapsByRecommendation = <T extends MapRecommendationTarget>(
  maps: T[],
  scores: MapRecommendationScore[]
): T[] =>
  [...maps].sort((left, right) => {
    const leftScore = getMapRecommendationScore(left, scores);
    const rightScore = getMapRecommendationScore(right, scores);
    if (leftScore === rightScore) return 0;
    if (leftScore === null) return 1;
    if (rightScore === null) return -1;
    return rightScore - leftScore;
  });
export const getMapRecommendationButtonStyle = (
  target: MapRecommendationTarget,
  scores: MapRecommendationScore[],
  selected: boolean
): Record<string, string> | undefined => {
  const relevance = getMapRecommendationRelevance(target, scores);
  if (relevance === null) return undefined;
  const greenWeight = Math.round(relevance * 100);
  const redWeight = 100 - greenWeight;
  const color = `color-mix(in oklch, var(--color-error-500) ${redWeight}%, var(--color-success-500) ${greenWeight}%)`;
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${selected ? 72 : 32}%, transparent)`,
    borderColor: color,
    color: 'var(--color-white)',
  };
};

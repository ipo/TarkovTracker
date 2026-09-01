import type { GameMode } from '@/utils/constants';
type StaticQuestHydrationHook = (mode: GameMode) => Promise<boolean>;
let hydrationHook: StaticQuestHydrationHook | null = null;
export const registerStaticQuestHydrationHook = (hook: StaticQuestHydrationHook): void => {
  hydrationHook = hook;
};
export const hydrateStaticQuestStores = async (mode: GameMode): Promise<boolean> => {
  if (!hydrationHook) return false;
  return hydrationHook(mode);
};

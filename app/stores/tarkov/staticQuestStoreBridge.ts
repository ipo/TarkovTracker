import type { GameMode } from '@/utils/constants';
type StaticQuestHydrationHook = (mode: GameMode) => Promise<void>;
let hydrationHook: StaticQuestHydrationHook | null = null;
export const registerStaticQuestHydrationHook = (hook: StaticQuestHydrationHook): void => {
  hydrationHook = hook;
};
export const hydrateStaticQuestStores = async (mode: GameMode): Promise<boolean> => {
  if (!hydrationHook) return false;
  await hydrationHook(mode);
  return true;
};

import { describe, expect, it } from 'vitest';
import { getMarksHash, type MapMark } from '@/features/maps/utils/marksHash';
describe('getMarksHash', () => {
  const baseMark: MapMark = {
    id: 'objective-1',
    zones: [],
    users: ['self'],
  };
  it('produces different hashes when only mark.pinned differs', () => {
    const unpinned: MapMark[] = [{ ...baseMark, pinned: false }];
    const pinned: MapMark[] = [{ ...baseMark, pinned: true }];
    const unpinnedHash = getMarksHash(unpinned, 'customs');
    const pinnedHash = getMarksHash(pinned, 'customs');
    expect(pinnedHash).not.toBe(unpinnedHash);
  });
  it('produces different hashes when recommendation styling changes', () => {
    const gateway: MapMark[] = [
      {
        ...baseMark,
        recommendation: { finishableHere: false, gateway: true, offGoal: false },
      },
    ];
    const offGoal: MapMark[] = [
      {
        ...baseMark,
        recommendation: { finishableHere: false, gateway: false, offGoal: true },
      },
    ];
    expect(getMarksHash(gateway, 'customs')).not.toBe(getMarksHash(offGoal, 'customs'));
  });
  it('produces the same hash for identical mark arrays', () => {
    const marksA: MapMark[] = [{ ...baseMark, pinned: true }];
    const marksB: MapMark[] = [{ ...baseMark, pinned: true }];
    expect(getMarksHash(marksA, 'customs')).toBe(getMarksHash(marksB, 'customs'));
  });
});

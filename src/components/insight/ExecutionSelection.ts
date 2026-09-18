import type { Dispatch, SetStateAction } from 'react';
import type { ExecutionAnchor } from '../../lib/insight/execution/executionAnchors';

export interface ExecutionSelection {
  fightId: string;
  timeMs: number;
  radiusMs: number;
  anchor: ExecutionAnchor;
  setTime: Dispatch<SetStateAction<number>>;
  setRadius: (radiusMs: number) => void;
  setFight: (fightId: string) => void;
}

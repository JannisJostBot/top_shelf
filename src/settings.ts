import { DIFF } from './data/difficulty';

export const settings: {
  puckKey: string;
  diffKey: string;
  diff: (typeof DIFF)[keyof typeof DIFF];
  colorKey: string;
  cpuKey: string;
  viewMode: 'close' | 'wide';
  stadiumKey: string;
  muted: boolean;
  vibOn: boolean;
  celOn: boolean;
  fightsOn: boolean;
  zamOn: boolean;
} = {
  puckKey: 'classic',
  diffKey: 'pro',
  diff: DIFF.pro,
  colorKey: 'blue',
  cpuKey: 'auto',
  viewMode: 'close',
  stadiumKey: 'frost',
  muted: false,
  vibOn: true,
  celOn: true,
  fightsOn: true,
  zamOn: true,
};

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

import { DIFF } from './data/difficulty';

export const settings: {
  puckKey: string;
  diffKey: string;
  diff: (typeof DIFF)[keyof typeof DIFF];
  colorKey: string;
  cpuKey: string;
  viewMode: 'close' | 'wide' | 'arena';
  stadiumKey: string;
  muted: boolean;
  vibOn: boolean;
  celOn: boolean;
  fightsOn: boolean;
  zamOn: boolean;
  /** period length in seconds */
  periodLen: number;
  /** how CPU skaters behave: 'classic' or 'realistic' */
  cpuStyle: 'classic' | 'realistic';
  /** stick style per team (keys of STICKS) */
  sticks: [string, string];
  /** Watch mode camera: the directed 'cine' shots or the 'classic' top-down view */
  watchCam: 'cine' | 'classic';
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
  periodLen: 60,
  cpuStyle: 'classic',
  sticks: ['wood', 'wood'],
  watchCam: 'cine',
};

export const reduceMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

import type { DialPadKey } from '@/types';

export const DIALER_FONT_FAMILY = 'SpaceMono';

export const DIAL_PAD_KEYS: DialPadKey[][] = [
  [
    { digit: '1' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
  ],
  [
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
  ],
  [
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ],
  [{ digit: '*' }, { digit: '0', letters: '+' }, { digit: '#' }],
];

export const MAX_PHONE_NUMBER_LENGTH = 15;

export const CALL_HISTORY_TABS = [
  { key: 'incoming' as const, label: 'Incoming' },
  { key: 'outgoing' as const, label: 'Outgoing' },
  { key: 'missed' as const, label: 'Missed' },
];

export const ACTIVE_CALL_CONTROLS = [
  { key: 'mute', label: 'Mute' },
  { key: 'speaker', label: 'Speaker' },
  { key: 'hold', label: 'Hold' },
  { key: 'keypad', label: 'Keypad' },
  { key: 'transfer', label: 'Transfer' },
] as const;

export type ActiveCallControlKey = (typeof ACTIVE_CALL_CONTROLS)[number]['key'];

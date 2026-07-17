import type { CallRecord, Contact } from '@/types';

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'Sarah Johnson',
    phoneNumber: '+1 (555) 234-5678',
    avatarInitials: 'SJ',
    isFavorite: true,
  },
  {
    id: 'c2',
    name: 'Michael Chen',
    phoneNumber: '+1 (555) 876-5432',
    avatarInitials: 'MC',
    isFavorite: true,
  },
  {
    id: 'c3',
    name: 'Emily Davis',
    phoneNumber: '+1 (555) 345-6789',
    avatarInitials: 'ED',
    isFavorite: false,
  },
  {
    id: 'c4',
    name: 'Support Desk',
    phoneNumber: '+1 (800) 555-0199',
    avatarInitials: 'SD',
    isFavorite: true,
  },
  {
    id: 'c5',
    name: 'James Wilson',
    phoneNumber: '+1 (555) 456-7890',
    avatarInitials: 'JW',
    isFavorite: false,
  },
];

const hoursAgo = (hours: number): string => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const MOCK_INCOMING_CALLS: CallRecord[] = [
  {
    id: 'inc-1',
    phoneNumber: '+1 (555) 234-5678',
    contactName: 'Sarah Johnson',
    contactId: 'c1',
    type: 'incoming',
    status: 'ended',
    duration: 245,
    startedAt: hoursAgo(2),
    endedAt: hoursAgo(2),
    notes: 'Discussed billing inquiry. Follow up scheduled.',
  },
  {
    id: 'inc-2',
    phoneNumber: '+1 (555) 987-6543',
    type: 'incoming',
    status: 'ended',
    duration: 89,
    startedAt: hoursAgo(5),
    endedAt: hoursAgo(5),
  },
  {
    id: 'inc-3',
    phoneNumber: '+1 (800) 555-0199',
    contactName: 'Support Desk',
    contactId: 'c4',
    type: 'incoming',
    status: 'ended',
    duration: 412,
    startedAt: daysAgo(1),
    endedAt: daysAgo(1),
    notes: 'Escalated to tier 2 support.',
  },
];

export const MOCK_OUTGOING_CALLS: CallRecord[] = [
  {
    id: 'out-1',
    phoneNumber: '+1 (555) 876-5432',
    contactName: 'Michael Chen',
    contactId: 'c2',
    type: 'outgoing',
    status: 'ended',
    duration: 156,
    startedAt: hoursAgo(1),
    endedAt: hoursAgo(1),
  },
  {
    id: 'out-2',
    phoneNumber: '+1 (555) 345-6789',
    contactName: 'Emily Davis',
    contactId: 'c3',
    type: 'outgoing',
    status: 'ended',
    duration: 320,
    startedAt: hoursAgo(8),
    endedAt: hoursAgo(8),
    notes: 'Product demo completed successfully.',
  },
  {
    id: 'out-3',
    phoneNumber: '+1 (555) 111-2222',
    type: 'outgoing',
    status: 'failed',
    duration: 0,
    startedAt: daysAgo(2),
    endedAt: daysAgo(2),
  },
];

export const MOCK_MISSED_CALLS: CallRecord[] = [
  {
    id: 'mis-1',
    phoneNumber: '+1 (555) 456-7890',
    contactName: 'James Wilson',
    contactId: 'c5',
    type: 'missed',
    status: 'missed',
    duration: 0,
    startedAt: hoursAgo(3),
  },
  {
    id: 'mis-2',
    phoneNumber: '+1 (555) 999-8888',
    type: 'missed',
    status: 'missed',
    duration: 0,
    startedAt: hoursAgo(12),
  },
  {
    id: 'mis-3',
    phoneNumber: '+1 (555) 234-5678',
    contactName: 'Sarah Johnson',
    contactId: 'c1',
    type: 'missed',
    status: 'missed',
    duration: 0,
    startedAt: daysAgo(1),
  },
];

export const MOCK_CALL_HISTORY: CallRecord[] = [
  ...MOCK_INCOMING_CALLS,
  ...MOCK_OUTGOING_CALLS,
  ...MOCK_MISSED_CALLS,
].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

export const MOCK_RECENT_CONTACTS: Contact[] = MOCK_CONTACTS.slice(0, 3);

export const MOCK_FAVORITE_CONTACTS: Contact[] = MOCK_CONTACTS.filter((c) => c.isFavorite);

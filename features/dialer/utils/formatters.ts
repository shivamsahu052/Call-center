import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatCallTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return time;
  }

  if (isYesterday) {
    return `Yesterday, ${time}`;
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCallDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function generateCallId(prefix = 'call'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getCallTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function getCallStatusLabel(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function findContactByNumber(
  phoneNumber: string,
  contacts: { id: string; name: string; phoneNumber: string }[],
): { id: string; name: string; phoneNumber: string } | undefined {
  const normalized = normalizePhoneNumber(phoneNumber);
  return contacts.find((c) => normalizePhoneNumber(c.phoneNumber) === normalized);
}

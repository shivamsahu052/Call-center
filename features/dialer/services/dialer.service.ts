import { MAX_PHONE_NUMBER_LENGTH } from '@/constants';
import { formatPhoneNumber, normalizePhoneNumber } from '@/features/dialer/utils/formatters';

/**
 * Dialer input service — handles phone number formatting and validation.
 * Decoupled from UI so the same logic works with any keypad component.
 */
export interface DialerServiceInterface {
  appendDigit(current: string, digit: string): string;
  removeLastDigit(current: string): string;
  formatDisplay(raw: string): string;
  isValidForCall(raw: string): boolean;
  sanitize(raw: string): string;
}

class DialerService implements DialerServiceInterface {
  appendDigit(current: string, digit: string): string {
    const sanitized = this.sanitize(current + digit);
    return sanitized.slice(0, MAX_PHONE_NUMBER_LENGTH);
  }

  removeLastDigit(current: string): string {
    return current.slice(0, -1);
  }

  formatDisplay(raw: string): string {
    return formatPhoneNumber(raw);
  }

  isValidForCall(raw: string): boolean {
    const digits = normalizePhoneNumber(raw);
    return digits.length >= 3;
  }

  sanitize(raw: string): string {
    return raw.replace(/[^\d*#+]/g, '');
  }
}

export const dialerService: DialerServiceInterface = new DialerService();

import { DayOfWeek } from '../types/database';

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Thứ 2',
  tuesday: 'Thứ 3',
  wednesday: 'Thứ 4',
  thursday: 'Thứ 5',
  friday: 'Thứ 6',
};

export function getPaymentBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'paid':
      return { label: 'Đã thanh toán', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'pending':
      return { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'unpaid':
    default:
      return { label: 'Chưa thanh toán', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  }
}

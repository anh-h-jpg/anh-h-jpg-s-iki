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

export function formatWeekTitle(weekStart: string): string {
  if (!weekStart) return 'Tuần chưa xác định';
  const clean = weekStart.split('T')[0].trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const startDate = new Date(y, m, d);
    const endDate = new Date(y, m, d + 4);
    const startDay = String(startDate.getDate()).padStart(2, '0');
    const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDate.getDate()).padStart(2, '0');
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    return `Tuần ${startDay}/${startMonth} - ${endDay}/${endMonth}`;
  }
  return `Tuần ${weekStart}`;
}

export function formatConfirmedAtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

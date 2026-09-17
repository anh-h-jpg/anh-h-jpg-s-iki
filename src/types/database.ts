export type UserRole = 'staff' | 'admin' | 'kitchen';

export interface User {
  id: string;
  name: string;
  department: string | null;
  role: UserRole;
  transfer_code: string | null;
  auth_uid?: string | null;
  created_at?: string;
}

export interface WeeklyMenu {
  id: string;
  week_start: string; // date YYYY-MM-DD
  locked_at?: string | null;
  created_by?: string;
}

// Exactly: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Thứ 2',
  tuesday: 'Thứ 3',
  wednesday: 'Thứ 4',
  thursday: 'Thứ 5',
  friday: 'Thứ 6',
};

export interface MenuItem {
  id: string;
  weekly_menu_id: string;
  day_of_week: DayOfWeek;
  name: string;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  menu_item_id: string;
  quantity: number; // > 0
  updated_at?: string;
  menu_item?: MenuItem;
}

export type PaymentStatus = 'unpaid' | 'paid';

export interface Payment {
  id: string;
  user_id: string;
  weekly_menu_id: string;
  amount_due: number;
  status: PaymentStatus;
  method?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  bank_ref?: string | null;
}

export interface Feedback {
  id: string;
  user_id: string;
  menu_item_id: string;
  rating: number; // 1-5
  comment: string;
  created_at?: string;
  user?: User;
  menu_item?: MenuItem;
}

// Database View: kitchen_summary
// Cột: weekly_menu_id, week_start, menu_item_id, day_of_week, item_name, total_quantity
export interface KitchenSummaryRow {
  weekly_menu_id: string;
  week_start: string;
  menu_item_id: string;
  day_of_week: DayOfWeek;
  item_name: string;
  total_quantity: number;
}

// Database View: payment_status_admin
// Cột: user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at
export interface PaymentStatusAdminRow {
  user_id: string;
  name: string;
  department: string | null;
  transfer_code: string | null;
  payment_id: string | null;
  weekly_menu_id: string;
  amount_due: number | null;
  status: PaymentStatus | null;
  method: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

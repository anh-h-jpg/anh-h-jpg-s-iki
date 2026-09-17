/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  User,
  UserRole,
  WeeklyMenu,
  MenuItem,
  Order,
  Payment,
  Feedback,
  KitchenSummaryRow,
  PaymentStatusAdminRow,
  DayOfWeek,
  DAYS_OF_WEEK,
  DAY_NAMES,
} from '../types/database';

// Storage keys
export const STORAGE_SUPABASE_URL = 'app_lunch_supabase_url';
export const STORAGE_SUPABASE_KEY = 'app_lunch_supabase_anon_key';
export const STORAGE_CLAIMED_USER_ID = 'app_lunch_claimed_user_id';
export const STORAGE_CLAIMED_ROLE = 'app_lunch_claimed_role';
export const STORAGE_LOCAL_STATE = 'app_lunch_local_state_v3';

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Remove any trailing /rest/v1 or /rest/v1/ or /auth/v1 or trailing slashes
  url = url.replace(/\/rest\/v1\/?$/i, '');
  url = url.replace(/\/auth\/v1\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url;
}

export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  const envUrl = sanitizeSupabaseUrl((import.meta.env.VITE_SUPABASE_URL || '').trim());
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const customUrl = sanitizeSupabaseUrl((localStorage.getItem(STORAGE_SUPABASE_URL) || '').trim());
  const customKey = (localStorage.getItem(STORAGE_SUPABASE_KEY) || '').trim();

  const url = customUrl || envUrl;
  const key = customKey || envKey;

  return {
    url,
    key,
    isConfigured: Boolean(url && key && url.startsWith('http')),
  };
}

export function saveCustomSupabaseCredentials(url: string, key: string) {
  const cleanUrl = sanitizeSupabaseUrl(url);
  if (cleanUrl) localStorage.setItem(STORAGE_SUPABASE_URL, cleanUrl);
  else localStorage.removeItem(STORAGE_SUPABASE_URL);

  if (key) localStorage.setItem(STORAGE_SUPABASE_KEY, key.trim());
  else localStorage.removeItem(STORAGE_SUPABASE_KEY);

  // Reset cached instance
  supabaseInstance = null;
  currentConfigKey = '';
}

export function clearCustomSupabaseCredentials() {
  localStorage.removeItem(STORAGE_SUPABASE_URL);
  localStorage.removeItem(STORAGE_SUPABASE_KEY);
  supabaseInstance = null;
  currentConfigKey = '';
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    return null;
  }

  const configKey = `${url}::${key}`;
  if (!supabaseInstance || currentConfigKey !== configKey) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      currentConfigKey = configKey;
    } catch (err) {
      console.error('Lỗi khởi tạo Supabase Client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

// Helper date functions
export function getMondayOfCurrentWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function formatDateYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDatesForCurrentWeek(mondayStr?: string): { day: DayOfWeek; dateStr: string; label: string; shortDate: string }[] {
  let monday: Date;
  if (mondayStr) {
    const parts = mondayStr.split('-');
    monday = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    monday = getMondayOfCurrentWeek();
  }

  const days: { day: DayOfWeek; dateStr: string; label: string; shortDate: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const dayOfWeek = DAYS_OF_WEEK[i];
    const dateStr = formatDateYYYYMMDD(current);
    const dayNum = current.getDate();
    const monthNum = current.getMonth() + 1;
    days.push({
      day: dayOfWeek,
      dateStr,
      label: DAY_NAMES[dayOfWeek],
      shortDate: `${dayNum < 10 ? '0' + dayNum : dayNum}/${monthNum < 10 ? '0' + monthNum : monthNum}`,
    });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Fallback Seed Data (used only when Supabase is not configured)
// ---------------------------------------------------------------------------
export const INITIAL_USERS: User[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Nguyễn Văn A', department: 'Kinh doanh', role: 'staff', transfer_code: 'U001' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Trần Thị B', department: 'Kỹ thuật', role: 'staff', transfer_code: 'U002' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Lê Văn C', department: 'Kỹ thuật', role: 'staff', transfer_code: 'U003' },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Phạm Thị D', department: 'Nhân sự', role: 'staff', transfer_code: 'U004' },
  { id: '55555555-5555-4555-8555-555555555555', name: 'Hoàng Văn E', department: 'Kinh doanh', role: 'staff', transfer_code: 'U005' },
  { id: '66666666-6666-4666-8666-666666666666', name: 'Bếp Test', department: 'Bếp', role: 'kitchen', transfer_code: null },
  { id: '77777777-7777-4777-8777-777777777777', name: 'Admin Test', department: 'Vận hành', role: 'admin', transfer_code: null },
];

const mondayCurrent = formatDateYYYYMMDD(getMondayOfCurrentWeek());

export const INITIAL_WEEKLY_MENU: WeeklyMenu = {
  id: 'menu-week-current',
  week_start: mondayCurrent,
  locked_at: null,
  created_by: '77777777-7777-4777-8777-777777777777',
};

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  // Thứ 2 (monday)
  { id: 'item-2-1', weekly_menu_id: 'menu-week-current', day_of_week: 'monday', name: 'Cơm sườn nướng', price: 35000 },
  { id: 'item-2-2', weekly_menu_id: 'menu-week-current', day_of_week: 'monday', name: 'Cơm gà xối mỡ', price: 35000 },

  // Thứ 3 (tuesday)
  { id: 'item-3-1', weekly_menu_id: 'menu-week-current', day_of_week: 'tuesday', name: 'Bún bò Huế', price: 40000 },
  { id: 'item-3-2', weekly_menu_id: 'menu-week-current', day_of_week: 'tuesday', name: 'Cơm cá kho tộ', price: 35000 },

  // Thứ 4 (wednesday)
  { id: 'item-4-1', weekly_menu_id: 'menu-week-current', day_of_week: 'wednesday', name: 'Cơm tấm bì chả', price: 35000 },
  { id: 'item-4-2', weekly_menu_id: 'menu-week-current', day_of_week: 'wednesday', name: 'Phở bò', price: 40000 },

  // Thứ 5 (thursday)
  { id: 'item-5-1', weekly_menu_id: 'menu-week-current', day_of_week: 'thursday', name: 'Cơm gà chiên nước mắm', price: 35000 },
  { id: 'item-5-2', weekly_menu_id: 'menu-week-current', day_of_week: 'thursday', name: 'Bún riêu', price: 35000 },

  // Thứ 6 (friday)
  { id: 'item-6-1', weekly_menu_id: 'menu-week-current', day_of_week: 'friday', name: 'Cơm sườn bì chả', price: 35000 },
  { id: 'item-6-2', weekly_menu_id: 'menu-week-current', day_of_week: 'friday', name: 'Mì xào hải sản', price: 40000 },
];

export const INITIAL_ORDERS: Order[] = [
  { id: 'order-1', user_id: '11111111-1111-4111-8111-111111111111', menu_item_id: 'item-2-1', quantity: 1, updated_at: new Date().toISOString() },
  { id: 'order-2', user_id: '11111111-1111-4111-8111-111111111111', menu_item_id: 'item-3-1', quantity: 1, updated_at: new Date().toISOString() },
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    user_id: '11111111-1111-4111-8111-111111111111',
    weekly_menu_id: 'menu-week-current',
    amount_due: 85000,
    status: 'unpaid',
    method: 'cash',
  },
];

// Local state engine when Supabase is not connected
class LocalLunchEngine {
  private users: User[] = INITIAL_USERS;
  private weeklyMenus: WeeklyMenu[] = [INITIAL_WEEKLY_MENU];
  private menuItems: MenuItem[] = INITIAL_MENU_ITEMS;
  private orders: Order[] = INITIAL_ORDERS;
  private payments: Payment[] = INITIAL_PAYMENTS;
  private feedbackList: Feedback[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_LOCAL_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.users) this.users = parsed.users;
        if (parsed.weeklyMenus) this.weeklyMenus = parsed.weeklyMenus;
        if (parsed.menuItems) this.menuItems = parsed.menuItems;
        if (parsed.orders) this.orders = parsed.orders;
        if (parsed.payments) this.payments = parsed.payments;
        if (parsed.feedbackList) this.feedbackList = parsed.feedbackList;
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        STORAGE_LOCAL_STATE,
        JSON.stringify({
          users: this.users,
          weeklyMenus: this.weeklyMenus,
          menuItems: this.menuItems,
          orders: this.orders,
          payments: this.payments,
          feedbackList: this.feedbackList,
        })
      );
    } catch {
      // ignore
    }
    this.notify();
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public getUsers(): User[] {
    return [...this.users];
  }

  public getWeeklyMenus(): WeeklyMenu[] {
    return [...this.weeklyMenus];
  }

  public getMenuItems(): MenuItem[] {
    return [...this.menuItems];
  }

  public getOrders(): Order[] {
    return [...this.orders];
  }

  public getPayments(): Payment[] {
    return [...this.payments];
  }

  public getFeedbacks(): Feedback[] {
    return [...this.feedbackList];
  }

  public registerAndClaim(name: string, department: string | null, role: UserRole = 'staff'): User {
    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      department: department || 'Nhân sự',
      role,
      transfer_code: role === 'kitchen' ? null : `NV${Math.floor(100 + Math.random() * 900)}`,
      created_at: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.saveToStorage();
    return newUser;
  }

  public getKitchenSummary(weeklyMenuId: string): KitchenSummaryRow[] {
    const targetMenu = this.weeklyMenus.find((m) => m.id === weeklyMenuId) || this.weeklyMenus[0];
    const items = this.menuItems.filter((i) => i.weekly_menu_id === targetMenu?.id);
    const summary: KitchenSummaryRow[] = [];

    for (const item of items) {
      const itemOrders = this.orders.filter((o) => o.menu_item_id === item.id);
      const totalQty = itemOrders.reduce((sum, o) => sum + o.quantity, 0);

      summary.push({
        weekly_menu_id: item.weekly_menu_id,
        week_start: targetMenu ? targetMenu.week_start : '',
        menu_item_id: item.id,
        day_of_week: item.day_of_week,
        item_name: item.name,
        total_quantity: totalQty,
      });
    }

    return summary.sort(
      (a, b) => DAYS_OF_WEEK.indexOf(a.day_of_week) - DAYS_OF_WEEK.indexOf(b.day_of_week)
    );
  }

  public getPaymentStatusAdmin(weeklyMenuId: string): PaymentStatusAdminRow[] {
    const staffUsers = this.users.filter((u) => u.role === 'staff');
    const itemsMap = new Map(this.menuItems.map((i) => [i.id, i]));

    return staffUsers.map((u) => {
      const existingPay = this.payments.find((p) => p.user_id === u.id && p.weekly_menu_id === weeklyMenuId);
      const userOrders = this.orders.filter((o) => o.user_id === u.id);
      
      let calculatedAmount = 0;
      for (const ord of userOrders) {
        const it = itemsMap.get(ord.menu_item_id);
        if (it && it.weekly_menu_id === weeklyMenuId) {
          calculatedAmount += it.price * ord.quantity;
        }
      }

      const amountDue = existingPay ? existingPay.amount_due : calculatedAmount;
      const status = existingPay ? existingPay.status : (calculatedAmount > 0 ? 'unpaid' : null);

      return {
        user_id: u.id,
        name: u.name,
        department: u.department,
        transfer_code: u.transfer_code,
        payment_id: existingPay ? existingPay.id : null,
        weekly_menu_id: weeklyMenuId,
        amount_due: amountDue,
        status: status,
        method: existingPay?.method || null,
        confirmed_by: existingPay?.confirmed_by || null,
        confirmed_at: existingPay?.confirmed_at || null,
      };
    });
  }

  public claimProfile(targetUserId: string): { success: boolean; user?: User } {
    const user = this.users.find((u) => u.id === targetUserId);
    if (!user) return { success: false };
    return { success: true, user };
  }

  public generatePayments(weeklyMenuId: string): { count: number } {
    const itemsMap = new Map(this.menuItems.map((i) => [i.id, i]));
    const staffUsers = this.users.filter((u) => u.role === 'staff');
    let generatedCount = 0;

    for (const u of staffUsers) {
      const userOrders = this.orders.filter((o) => o.user_id === u.id);
      let total = 0;
      for (const ord of userOrders) {
        const it = itemsMap.get(ord.menu_item_id);
        if (it && it.weekly_menu_id === weeklyMenuId) {
          total += it.price * ord.quantity;
        }
      }

      if (total > 0) {
        const existingIdx = this.payments.findIndex((p) => p.user_id === u.id && p.weekly_menu_id === weeklyMenuId);
        if (existingIdx >= 0) {
          if (this.payments[existingIdx].status === 'unpaid') {
            this.payments[existingIdx].amount_due = total;
          }
        } else {
          this.payments.push({
            id: `pay-${Date.now()}-${u.id.slice(0, 4)}`,
            user_id: u.id,
            weekly_menu_id: weeklyMenuId,
            amount_due: total,
            status: 'unpaid',
            method: 'cash',
          });
          generatedCount++;
        }
      }
    }

    this.saveToStorage();
    return { count: generatedCount };
  }

  public confirmPayment(paymentId: string, confirmedBy: string): boolean {
    const p = this.payments.find((item) => item.id === paymentId);
    if (p) {
      p.status = 'paid';
      p.method = 'cash';
      p.confirmed_by = confirmedBy;
      p.confirmed_at = new Date().toISOString();
      this.saveToStorage();
      return true;
    }
    return false;
  }

  public upsertOrder(userId: string, menuItemId: string, quantity: number) {
    if (quantity <= 0) {
      this.orders = this.orders.filter((o) => !(o.user_id === userId && o.menu_item_id === menuItemId));
    } else {
      const existing = this.orders.find((o) => o.user_id === userId && o.menu_item_id === menuItemId);
      if (existing) {
        existing.quantity = quantity;
        existing.updated_at = new Date().toISOString();
      } else {
        this.orders.push({
          id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          menu_item_id: menuItemId,
          quantity,
          updated_at: new Date().toISOString(),
        });
      }
    }
    this.saveToStorage();
  }

  public addMenuItem(item: Omit<MenuItem, 'id'>): MenuItem {
    const newItem: MenuItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    this.menuItems.push(newItem);
    this.saveToStorage();
    return newItem;
  }

  public deleteMenuItem(id: string) {
    this.menuItems = this.menuItems.filter((i) => i.id !== id);
    this.orders = this.orders.filter((o) => o.menu_item_id !== id);
    this.saveToStorage();
  }

  public createWeeklyMenu(weekStart: string, createdBy: string): WeeklyMenu {
    const newMenu: WeeklyMenu = {
      id: `menu-${Date.now()}`,
      week_start: weekStart,
      locked_at: null,
      created_by: createdBy,
    };
    this.weeklyMenus.unshift(newMenu);
    this.saveToStorage();
    return newMenu;
  }

  public lockWeeklyMenu(menuId: string) {
    const menu = this.weeklyMenus.find((m) => m.id === menuId);
    if (menu) {
      menu.locked_at = new Date().toISOString();
      this.saveToStorage();
    }
  }

  public addFeedback(fb: Omit<Feedback, 'id' | 'created_at'>): Feedback {
    const newFb: Feedback = {
      ...fb,
      id: `fb-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.feedbackList.unshift(newFb);
    this.saveToStorage();
    return newFb;
  }

  public resetDemoData() {
    this.users = INITIAL_USERS;
    this.weeklyMenus = [INITIAL_WEEKLY_MENU];
    this.menuItems = INITIAL_MENU_ITEMS;
    this.orders = INITIAL_ORDERS;
    this.payments = INITIAL_PAYMENTS;
    this.feedbackList = [];
    this.saveToStorage();
  }
}

export const localLunchEngine = new LocalLunchEngine();

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  AppSettings,
} from '../types/database';
import {
  checkDayDeadline,
  getDateStrForDayOfWeek,
  getStandardTime,
  getVietnamDateString,
  DayDeadlineInfo,
} from '../utils/deadline';
import {
  getSupabaseClient,
  getSupabaseCredentials,
  STORAGE_CLAIMED_USER_ID,
  STORAGE_CLAIMED_ROLE,
} from '../lib/supabase';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

interface AppContextType {
  // State
  users: User[];
  currentUser: User | null;
  activeRole: UserRole | null;
  weeklyMenus: WeeklyMenu[];
  currentWeeklyMenu: WeeklyMenu | null;
  menuItems: MenuItem[];
  orders: Order[];
  payments: Payment[];
  kitchenSummary: KitchenSummaryRow[];
  paymentAdminList: PaymentStatusAdminRow[];
  feedbacks: Feedback[];
  loading: boolean;
  actionLoading: boolean;
  isSupabaseLive: boolean;
  connectionError: string | null;
  retryConnection: () => Promise<void>;
  lastKitchenUpdate: Date | null;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;

  // App Settings & Server Time sync
  appSettings: AppSettings;
  serverOffsetMs: number;
  syncServerNow: () => Promise<void>;
  setOrderCutoff: (cutoffTime: string) => Promise<boolean>;
  getDeadlineForDay: (day: DayOfWeek) => DayDeadlineInfo;
  reloadOrders: () => Promise<void>;

  // Authentication & Profile claiming
  claimProfile: (targetUserId: string) => Promise<boolean>;
  registerAndClaim: (name: string, department: string, role?: UserRole) => Promise<boolean>;
  signInWithGoogleAdmin: () => Promise<void>;
  logout: () => Promise<void>;
  switchUser: () => Promise<void>;
  setActiveRole: (role: UserRole) => void;

  // Employee actions
  upsertOrder: (menuItemId: string, quantity: number) => Promise<void>;
  submitFeedback: (menuItemId: string | undefined, rating: number, comment: string) => Promise<boolean>;
  requestPaymentConfirmation: (weeklyMenuId: string, amountDue: number) => Promise<boolean>;

  // Kitchen actions
  refreshKitchenSummary: () => Promise<void>;

  // Admin actions
  refreshAdminPayments: () => Promise<void>;
  createWeeklyMenu: (weekStart: string) => Promise<WeeklyMenu | null>;
  lockWeeklyMenu: (menuId: string) => Promise<void>;
  addMenuItem: (item: { weekly_menu_id: string; day_of_week: DayOfWeek; name: string; price: number }) => Promise<MenuItem | null>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  toggleMenuItemClosed: (itemId: string, closed: boolean) => Promise<boolean>;
  generateWeeklyPayments: (weeklyMenuId: string) => Promise<number>;
  confirmCashPayment: (paymentId: string) => Promise<boolean>;
  rejectPaymentConfirmation: (paymentId: string) => Promise<boolean>;
  getMonthlyRevenue: (month: string) => Promise<{
    totalRevenue: number;
    hasWeeks: boolean;
    weekCount: number;
    weeksData: Array<{
      weeklyMenu: WeeklyMenu;
      paidPayments: Array<{
        id: string;
        user_id: string;
        weekly_menu_id: string;
        name: string;
        transfer_code: string | null;
        amount_due: number;
        confirmed_at: string | null;
        confirmed_by?: string | null;
      }>;
    }>;
  }>;

  // Feedback notifications & status
  lastSeenFeedbackAt: string | null;
  markFeedbacksAsSeen: () => void;
  hasUnseenFeedback: boolean;

  // Supabase Config & Connection Status
  refreshData: () => Promise<void>;
  seedSupabaseDatabase: () => Promise<boolean>;
  saveSupabaseConfig: (url: string, key: string) => Promise<{ success: boolean; message: string }>;
  disconnectSupabase: () => void;
  resetDemoData: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
  const [currentWeeklyMenu, setCurrentWeeklyMenu] = useState<WeeklyMenu | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [kitchenSummary, setKitchenSummary] = useState<KitchenSummaryRow[]>([]);
  const [paymentAdminList, setPaymentAdminList] = useState<PaymentStatusAdminRow[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastKitchenUpdate, setLastKitchenUpdate] = useState<Date | null>(new Date());
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // App settings (order_cutoff, timezone) & Server Time offset
  const [appSettings, setAppSettings] = useState<AppSettings>({
    id: 1,
    order_cutoff: '10:30:00',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);

  const syncServerNow = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data, error } = await client.rpc('server_now');
      if (!error && data) {
        const serverTime = new Date(data).getTime();
        if (!isNaN(serverTime)) {
          const diff = serverTime - Date.now();
          setServerOffsetMs(diff);
        }
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ giờ server_now:', err);
    }
  }, []);

  // Gọi server_now định kỳ mỗi 5 phút
  useEffect(() => {
    syncServerNow();
    const interval = setInterval(() => {
      syncServerNow();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncServerNow]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Refs để luôn truy cập giá trị mới nhất trong Realtime callbacks mà không cần re-subscribe
  const activeRoleRef = useRef(activeRole);
  useEffect(() => {
    activeRoleRef.current = activeRole;
  }, [activeRole]);

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const menuItemsRef = useRef(menuItems);
  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  // Quản lý trạng thái xem feedback của Admin trong phiên làm việc
  const [lastSeenFeedbackAt, setLastSeenFeedbackAt] = useState<string | null>(() => new Date().toISOString());

  const markFeedbacksAsSeen = useCallback(() => {
    setLastSeenFeedbackAt(new Date().toISOString());
  }, []);

  const hasUnseenFeedback = useMemo(() => {
    if (!lastSeenFeedbackAt) return feedbacks.length > 0;
    const lastSeenMs = new Date(lastSeenFeedbackAt).getTime();
    return feedbacks.some((fb) => {
      if (!fb.created_at) return false;
      const fbMs = new Date(fb.created_at).getTime();
      return !isNaN(fbMs) && fbMs > lastSeenMs;
    });
  }, [feedbacks, lastSeenFeedbackAt]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Fetch real data from Supabase client
  const loadSupabaseData = useCallback(async (client: ReturnType<typeof getSupabaseClient>) => {
    if (!client) {
      const { key, url } = getSupabaseCredentials();
      setConnectionError(
        !key
          ? 'Chưa cấu hình Supabase Anon Key. Vui lòng kiểm tra biến môi trường VITE_SUPABASE_ANON_KEY hoặc hằng số trong supabaseConfig.ts.'
          : `Không thể kết nối tới máy chủ Supabase (${url}).`
      );
      setIsSupabaseLive(false);
      setLoading(false);
      return false;
    }

    try {
      setLoading(true);

      // 0. Ensure anonymous auth session (Required by RLS: using (auth.uid() is not null))
      try {
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData?.session) {
          const { error: anonErr } = await client.auth.signInAnonymously();
          if (anonErr) {
            console.warn('Lưu ý về Anonymous Sign-in:', anonErr.message);
          }
        }
      } catch (authEx) {
        console.warn('Lỗi kiểm tra auth session:', authEx);
      }

      // 1. Fetch users: id, name, department, role, transfer_code, auth_uid, created_at
      const { data: usersData, error: userErr } = await client
        .from('users')
        .select('id, name, department, role, transfer_code, auth_uid, created_at')
        .order('name');
      if (userErr) {
        console.error('Lỗi lấy bảng users:', userErr);
        throw new Error(`Lỗi tải danh sách người dùng: ${userErr.message}`);
      } else if (usersData) {
        setUsers(usersData);
      }

      // 2. Fetch weekly_menus: id, week_start, locked_at, created_by
      const { data: menuData, error: menuErr } = await client
        .from('weekly_menus')
        .select('id, week_start, locked_at, created_by')
        .order('week_start', { ascending: false });

      let targetMenu: WeeklyMenu | null = null;
      if (menuErr) {
        console.error('Lỗi lấy weekly_menus:', menuErr);
        throw new Error(`Lỗi tải danh sách thực đơn: ${menuErr.message}`);
      } else if (menuData && menuData.length > 0) {
        setWeeklyMenus(menuData);
        targetMenu = menuData[0];
        setCurrentWeeklyMenu(targetMenu);
      } else {
        setWeeklyMenus([]);
        setCurrentWeeklyMenu(null);
      }

      // 3. Fetch menu items for current weekly menu
      if (targetMenu) {
        const { data: itemsData, error: itemErr } = await client
          .from('menu_items')
          .select('id, weekly_menu_id, day_of_week, name, price, is_closed')
          .eq('weekly_menu_id', targetMenu.id);
        if (itemErr) {
          console.warn('Lỗi lấy menu_items:', itemErr);
        } else if (itemsData) {
          setMenuItems(itemsData);
        }

        // 4. Fetch kitchen summary view
        const { data: kitchenData, error: kErr } = await client
          .from('kitchen_summary')
          .select('weekly_menu_id, week_start, menu_item_id, day_of_week, item_name, total_quantity')
          .eq('weekly_menu_id', targetMenu.id);
        if (!kErr && kitchenData) {
          setKitchenSummary(kitchenData);
          setLastKitchenUpdate(new Date());
        }

        // 5. Fetch payment_status_admin view
        const { data: payAdminData, error: pErr } = await client
          .from('payment_status_admin')
          .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at');
        if (!pErr && payAdminData) {
          setPaymentAdminList(payAdminData);
        }
      } else {
        setMenuItems([]);
        setKitchenSummary([]);
        setPaymentAdminList([]);
      }

      // 6. Fetch orders: id, user_id, menu_item_id, quantity, updated_at
      const { data: ordersData, error: ordErr } = await client
        .from('orders')
        .select('id, user_id, menu_item_id, quantity, updated_at');
      if (ordErr) {
        console.warn('Lỗi lấy orders:', ordErr);
      } else if (ordersData) {
        setOrders(ordersData);
      }

      // 7. Fetch payments: id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref
      const { data: paymentsData, error: payErr } = await client
        .from('payments')
        .select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref');
      if (payErr) {
        console.warn('Lỗi lấy payments:', payErr);
      } else if (paymentsData) {
        setPayments(paymentsData);
      }

      // 8. Fetch feedback: id, user_id, menu_item_id, rating, comment, created_at
      const { data: feedbackData, error: fbErr } = await client
        .from('feedback')
        .select('id, user_id, menu_item_id, rating, comment, created_at')
        .order('created_at', { ascending: false });
      if (fbErr) {
        console.warn('Lỗi lấy feedback:', fbErr);
      } else if (feedbackData) {
        setFeedbacks(feedbackData);
      }

      // 9. Fetch app_settings: id, order_cutoff, timezone
      try {
        const { data: settingsData } = await client
          .from('app_settings')
          .select('id, order_cutoff, timezone')
          .eq('id', 1)
          .maybeSingle();
        if (settingsData) {
          setAppSettings(settingsData);
        }
      } catch (stErr) {
        console.warn('Lỗi lấy app_settings:', stErr);
      }

      setConnectionError(null);
      setIsSupabaseLive(true);
      return true;
    } catch (err: any) {
      console.error('Không thể tải dữ liệu Supabase:', err);
      setIsSupabaseLive(false);
      setConnectionError(err?.message || 'Không thể kết nối đến máy chủ cơ sở dữ liệu Supabase.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
const refreshLiveData = useCallback(async () => {
  const client = getSupabaseClient();
  if (!client) return;
  const [u, o, p, v] = await Promise.all([
    client.from('users').select('id, name, department, role, transfer_code, auth_uid, created_at').order('name'),
    client.from('orders').select('id, user_id, menu_item_id, quantity, updated_at'),
    client.from('payments').select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref'),
    client.from('payment_status_admin').select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at'),
  ]);
  if (u.data) setUsers(u.data);
  if (o.data) setOrders(o.data);
  if (p.data) setPayments(p.data);
  if (v.data) setPaymentAdminList(v.data);
}, []);
  // Setup Realtime Subscription for kitchen view & orders
  const setupRealtimeSubscription = useCallback((client: ReturnType<typeof getSupabaseClient>) => {
    if (!client) return;

    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    try {
      const channel = client
        .channel('realtime_orders_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          async () => {
            // Re-fetch kitchen_summary, payment_status_admin, and orders
            await refreshLiveData();
            const currentMenuId = currentWeeklyMenu?.id;
            if (currentMenuId) {
              const { data: kitchenData } = await client
                .from('kitchen_summary')
                .select('weekly_menu_id, week_start, menu_item_id, day_of_week, item_name, total_quantity')
                .eq('weekly_menu_id', currentMenuId);
              if (kitchenData) {
                setKitchenSummary(kitchenData);
              }

              const { data: payAdminData } = await client
                .from('payment_status_admin')
                .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at');
              if (payAdminData) {
                setPaymentAdminList(payAdminData);
              }
            }

            const { data: newOrders } = await client
              .from('orders')
              .select('id, user_id, menu_item_id, quantity, updated_at');
            if (newOrders) setOrders(newOrders);

            setLastKitchenUpdate(new Date());
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'menu_items',
          },
          async () => {
            const currentMenuId = currentWeeklyMenu?.id;
            if (currentMenuId) {
              const { data: itemsData } = await client
                .from('menu_items')
                .select('id, weekly_menu_id, day_of_week, name, price, is_closed')
                .eq('weekly_menu_id', currentMenuId);
              if (itemsData) setMenuItems(itemsData);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
          },
          async () => {
            await refreshLiveData();
            const { data: paymentsData } = await client
              .from('payments')
              .select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref');
            if (paymentsData) {
              setPayments(paymentsData);
            }

            const currentMenuId = currentWeeklyMenu?.id;
            if (currentMenuId) {
              const { data: payAdminData } = await client
                .from('payment_status_admin')
                .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at');
              if (payAdminData) {
                setPaymentAdminList(payAdminData);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feedback',
          },
          async (payload) => {
            // Fetch lại toàn bộ feedback
            const { data: feedbackData, error: fbErr } = await client
              .from('feedback')
              .select('id, user_id, menu_item_id, rating, comment, created_at')
              .order('created_at', { ascending: false });
            if (!fbErr && feedbackData) {
              setFeedbacks(feedbackData);
            }

            // CHỈ khi activeRole === 'admin', hiển thị thông báo toast
            if (activeRoleRef.current === 'admin') {
              const newRow = payload?.new as { user_id?: string; menu_item_id?: string } | undefined;
              const sender = usersRef.current.find((u) => u.id === newRow?.user_id);
              const senderName = sender ? sender.name : 'nhân viên';
              const dish = menuItemsRef.current.find((m) => m.id === newRow?.menu_item_id);
              const dishName = dish ? dish.name : 'món ăn';

              showToast(`💬 Có góp ý mới từ ${senderName} về ${dishName}!`, 'info');
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Đã kết nối Supabase Realtime thành công trên bảng orders');
          }
        });

      channelRef.current = channel;
        } catch (err) {
      console.warn('Lỗi đăng ký Realtime Supabase:', err);
    }
  }, [currentWeeklyMenu?.id, refreshLiveData]);   // <-- thêm ", refreshLiveData"
    // Admin: tự tải lại dữ liệu mỗi 30 giây (dự phòng khi Realtime lỡ nhịp)
  useEffect(() => {
    if (activeRole !== 'admin') return;
    const timer = setInterval(() => {
      refreshLiveData();
    }, 30000);
    return () => clearInterval(timer);
  }, [activeRole, refreshLiveData]);

// Helper: Xóa các khóa claimed và mọi khóa localStorage bắt đầu bằng 'sb-'
const clearClaimedAndSbStorage = () => {
  try {
    localStorage.removeItem(STORAGE_CLAIMED_USER_ID);
    localStorage.removeItem(STORAGE_CLAIMED_ROLE);

    // Xóa mọi khóa localStorage bắt đầu bằng 'sb-'
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn('Lỗi khi dọn dẹp localStorage:', err);
  }
};

  const privilegedClaimPromiseRef = useRef<Promise<boolean> | null>(null);
  const authSubRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Privileged Auth: RPC claim_privileged_role for Admin & Kitchen via Google OAuth
  const runPrivilegedClaim = useCallback(
    async (client: SupabaseClient): Promise<boolean> => {
      try {
        const { data: privUser, error: privErr } = await client.rpc('claim_privileged_role');
        const userRecord: User | null = Array.isArray(privUser) ? privUser[0] : privUser;

        if (privErr || !userRecord || !userRecord.id) {
          console.warn('Lỗi kiểm tra quyền Admin/Bếp:', privErr);
          try {
            await client.auth.signOut();
          } catch (soErr) {
            console.warn('Lỗi signOut:', soErr);
          }
          clearClaimedAndSbStorage();
          setCurrentUser(null);
          setActiveRole(null);
          showToast(
            'Email này chưa được cấp quyền Admin/Bếp. Vui lòng liên hệ quản trị viên.',
            'error'
          );
          return false;
        }

        // Privileged claim successful
        localStorage.setItem(STORAGE_CLAIMED_USER_ID, userRecord.id);
        localStorage.setItem(STORAGE_CLAIMED_ROLE, userRecord.role);
        setCurrentUser(userRecord);
        setActiveRole(userRecord.role);
        setUsers((prev) => (prev.some((u) => u.id === userRecord.id) ? prev : [userRecord, ...prev]));
        showToast(
          `Đăng nhập thành công với vai trò ${userRecord.role === 'admin' ? 'Quản trị' : 'Bếp'} (${userRecord.name})`,
          'success'
        );
        return true;
      } catch (err: any) {
        console.error('Exception khi gọi claim_privileged_role:', err);
        try {
          await client.auth.signOut();
        } catch {
          // ignore
        }
        clearClaimedAndSbStorage();
        setCurrentUser(null);
        setActiveRole(null);
        showToast(
          'Email này chưa được cấp quyền Admin/Bếp. Vui lòng liên hệ quản trị viên.',
          'error'
        );
        return false;
      } finally {
        if (
          window.location.hash.includes('access_token=') ||
          window.location.hash.includes('error=') ||
          window.location.search.includes('code=')
        ) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    },
    [showToast]
  );
   const checkAndClaimPrivilegedRole = useCallback(
     (client: SupabaseClient): Promise<boolean> => {
       if (!privilegedClaimPromiseRef.current) {
         privilegedClaimPromiseRef.current = runPrivilegedClaim(client).finally(() => {
           privilegedClaimPromiseRef.current = null;
         });
       }
       return privilegedClaimPromiseRef.current;
     },
     [runPrivilegedClaim]
   );
  const signInWithGoogleAdmin = async () => {
    const client = getSupabaseClient();
    if (!client) {
      showToast('Chưa cấu hình kết nối Supabase!', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: { hd: 'dymvietnam.net' },
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) {
        showToast(error.message, 'error');
      }
    } catch (err: any) {
      console.error('Lỗi khi đăng nhập Google OAuth:', err);
      showToast(err?.message || 'Lỗi khi kết nối Google OAuth', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Initial Boot
  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      setLoading(true);
      setConnectionError(null);
      const client = getSupabaseClient();
      let isPrivilegedClaimed = false;

      if (!client) {
        setIsSupabaseLive(false);
        const { key, url } = getSupabaseCredentials();
        setConnectionError(
          !key
            ? 'Chưa cấu hình Supabase Anon Key. Vui lòng kiểm tra VITE_SUPABASE_ANON_KEY hoặc hằng số trong supabaseConfig.ts.'
            : `Không thể kết nối đến máy chủ Supabase (${url}). Vui lòng kiểm tra lại cấu hình và mạng.`
        );
        if (isMounted) setLoading(false);
        return;
      }

      // Kiểm tra vai trò lưu trên thiết bị từ trước
      const storedRoleAtStartup = localStorage.getItem(STORAGE_CLAIMED_ROLE) as UserRole | null;
      let isSessionValid = false;

      // Step 1: Check Auth Session (Google OAuth vs Anonymous)
      try {
        const { data: sessionData, error: sessionErr } = await client.auth.getSession();
        const session = sessionData?.session;

        // Session được coi là hợp lệ khi: không có lỗi, session tồn tại, không ẩn danh, có email và chưa hết hạn
        if (
          !sessionErr &&
          session &&
          !session.user.is_anonymous &&
          session.user.email &&
          (!session.expires_at || session.expires_at * 1000 > Date.now())
        ) {
          isSessionValid = true;
          isPrivilegedClaimed = await checkAndClaimPrivilegedRole(client);
        } else if (!session) {
          const { error: anonErr } = await client.auth.signInAnonymously();
          if (anonErr) console.warn('Lưu ý Anonymous Auth:', anonErr.message);
        }
      } catch (authErr) {
        console.warn('Supabase Auth check:', authErr);
      }

      // Yêu cầu: nếu STORAGE_CLAIMED_ROLE là admin/kitchen mà supabase.auth.getSession() không có session hợp lệ:
      // xóa các khóa claimed và về màn "Bạn là ai?" kèm thông báo "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"
      if (
        (storedRoleAtStartup === 'admin' || storedRoleAtStartup === 'kitchen') &&
        (!isSessionValid || !isPrivilegedClaimed)
      ) {
        clearClaimedAndSbStorage();
        setCurrentUser(null);
        setActiveRole(null);
        showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'error');
      }

      const ok = await loadSupabaseData(client);
      if (!ok) {
        if (isMounted) setLoading(false);
        return;
      }

      setupRealtimeSubscription(client);

      // Step 2: Listen to auth events for OAuth redirect completion
      const { data: authSub } = client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session && !session.user.is_anonymous && session.user.email) {
          await checkAndClaimPrivilegedRole(client);
        } else if (event === 'SIGNED_OUT') {
          clearClaimedAndSbStorage();
          setCurrentUser(null);
          setActiveRole(null);
        }
      });
      authSubRef.current = authSub.subscription;

      // Check stored user profile (for staff or persistent session)
      const storedUserId = localStorage.getItem(STORAGE_CLAIMED_USER_ID);
      const storedRole = localStorage.getItem(STORAGE_CLAIMED_ROLE) as UserRole | null;

      if (storedUserId && !isPrivilegedClaimed) {
        if (storedRole === 'admin' || storedRole === 'kitchen') {
          clearClaimedAndSbStorage();
          setCurrentUser(null);
          setActiveRole(null);
          showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'error');
        } else {
          let found: User | undefined;
          try {
            const { data: userData } = await client
              .from('users')
              .select('id, name, department, role, transfer_code, auth_uid, created_at')
              .eq('id', storedUserId)
              .single();
            if (userData) found = userData;
          } catch {
            // ignore
          }

          if (!found) {
            clearClaimedAndSbStorage();
          } else {
            setCurrentUser(found);
            setActiveRole(storedRole || found.role);

            try {
              await client.rpc('claim_profile', { target_user_id: found.id });
            } catch (err) {
              console.warn('Auto claim_profile error:', err);
            }
          }
        }
      }

      if (isMounted) setLoading(false);
    }

    initApp();

    return () => {
      isMounted = false;
      if (channelRef.current && getSupabaseClient()) {
        getSupabaseClient()?.removeChannel(channelRef.current);
      }
      if (authSubRef.current) {
        authSubRef.current.unsubscribe();
        authSubRef.current = null;
      }
    };
  }, [loadSupabaseData, setupRealtimeSubscription, checkAndClaimPrivilegedRole]);

  // Retry connection action
  const retryConnection = useCallback(async () => {
    setLoading(true);
    setConnectionError(null);
    const client = getSupabaseClient();
    if (!client) {
      const { key, url } = getSupabaseCredentials();
      setConnectionError(
        !key
          ? 'Chưa cấu hình Supabase Anon Key. Vui lòng khai báo VITE_SUPABASE_ANON_KEY hoặc hằng số trong supabaseConfig.ts.'
          : `Không thể kết nối đến máy chủ Supabase (${url}). Vui lòng kiểm tra lại cấu hình và mạng.`
      );
      setLoading(false);
      return;
    }
    const ok = await loadSupabaseData(client);
    if (ok) {
      setupRealtimeSubscription(client);
      syncServerNow();
    }
    setLoading(false);
  }, [loadSupabaseData, setupRealtimeSubscription, syncServerNow]);

  // Claim Profile Flow: RPC claim_profile(target_user_id: uuid)
  const claimProfile = async (targetUserId: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      let selectedUser: User | undefined;

      if (client) {
        // Ensure anonymous session
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) {
          await client.auth.signInAnonymously();
        }

        // Call RPC claim_profile(target_user_id: uuid)
        const { data: rpcUser, error: rpcErr } = await client.rpc('claim_profile', {
          target_user_id: targetUserId,
        });

        if (rpcErr) {
          console.warn('Lỗi gọi RPC claim_profile:', rpcErr);
        } else if (rpcUser) {
          selectedUser = rpcUser;
        }

        if (!selectedUser) {
          const { data: userData } = await client
            .from('users')
            .select('*')
            .eq('id', targetUserId)
            .single();
          if (userData) selectedUser = userData;
        }
      }

      if (!selectedUser) {
        selectedUser = users.find((u) => u.id === targetUserId);
      }

      if (!selectedUser) {
        showToast('Không tìm thấy thông tin tài khoản!', 'error');
        return false;
      }

      localStorage.setItem(STORAGE_CLAIMED_USER_ID, selectedUser.id);
      localStorage.setItem(STORAGE_CLAIMED_ROLE, selectedUser.role);

      setCurrentUser(selectedUser);
      setActiveRole(selectedUser.role);
      showToast(`Xin chào ${selectedUser.name}!`, 'success');
      return true;
    } catch (err: any) {
      console.error('Lỗi khi chọn tài khoản:', err);
      showToast(err?.message || 'Lỗi khi chọn tài khoản', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // RPC register_and_claim(p_name: text, p_department: text) or direct INSERT
  const registerAndClaim = async (name: string, department: string, role: UserRole = 'staff'): Promise<boolean> => {
    if (!name.trim()) {
      showToast('Vui lòng nhập họ và tên', 'error');
      return false;
    }

    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      let newUser: User | undefined;

      if (client) {
        // Try calling RPC register_and_claim first
        try {
          const { data: rpcUser, error: rpcErr } = await client.rpc('register_and_claim', {
            p_name: name.trim(),
            p_department: department.trim() || null,
          });
          if (!rpcErr && rpcUser) {
            newUser = rpcUser;
          }
        } catch {
          // RPC may not exist, fallback to direct insert
        }

        // If RPC not available, do direct INSERT into users
        if (!newUser) {
          const codePrefix = department.trim() ? department.trim().slice(0, 3).toUpperCase() : 'NV';
          const generatedCode = role === 'kitchen' ? null : `${codePrefix}${Math.floor(100 + Math.random() * 900)}`;

          const { data: insertedUser, error: insErr } = await client
            .from('users')
            .insert({
              name: name.trim(),
              department: department.trim() || null,
              role: role,
              transfer_code: generatedCode,
            })
            .select()
            .single();

          if (insErr) {
            if (insErr.code === '42501') {
              throw new Error('Chính sách RLS của Supabase đang chặn thêm tài khoản (mã 42501). Hãy mở Supabase Dashboard > SQL Editor để chạy script mở quyền (bấm nút "Mã SQL & RLS" ở góc trên để lấy câu lệnh SQL).');
            }
            throw insErr;
          }
          newUser = insertedUser;
        }
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để tạo tài khoản.');
      }

      if (!newUser) {
        throw new Error('Không thể tạo hồ sơ người dùng');
      }

      // Add to users list if not present
      setUsers((prev) => (prev.some((u) => u.id === newUser!.id) ? prev : [newUser!, ...prev]));

      // Save to localStorage
      localStorage.setItem(STORAGE_CLAIMED_USER_ID, newUser.id);
      localStorage.setItem(STORAGE_CLAIMED_ROLE, newUser.role);

      setCurrentUser(newUser);
      setActiveRole(newUser.role);
      showToast(`Đã tạo tài khoản và đăng nhập: ${newUser.name}!`, 'success');
      return true;
    } catch (err: any) {
      console.error('Lỗi register_and_claim:', err);
      showToast(err?.message || 'Lỗi đăng ký tài khoản', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Lỗi supabase.auth.signOut():', err);
      }
    }

    // DÙ thành công hay lỗi, đều phải xóa các khóa STORAGE_CLAIMED_USER_ID, STORAGE_CLAIMED_ROLE và mọi khóa localStorage bắt đầu bằng 'sb-'
    clearClaimedAndSbStorage();
    setCurrentUser(null);
    setActiveRole(null);
  };

  const switchUser = logout;

  const setOrderCutoff = async (cutoffTime: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) {
      showToast('Chưa kết nối Supabase', 'error');
      return false;
    }
    setActionLoading(true);
    try {
      const { data, error } = await client
        .from('app_settings')
        .upsert({ id: 1, order_cutoff: cutoffTime, timezone: 'Asia/Ho_Chi_Minh' })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setAppSettings(data);
      }
      showToast(`Đã đổi giờ chốt đơn thành ${cutoffTime}`, 'success');
      return true;
    } catch (err: any) {
      console.error('Lỗi setOrderCutoff:', err);
      showToast('Lỗi cập nhật giờ chốt đơn: ' + (err.message || ''), 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const getDeadlineForDay = useCallback(
    (day: DayOfWeek): DayDeadlineInfo => {
      if (!currentWeeklyMenu?.week_start) {
        return checkDayDeadline(getVietnamDateString(new Date()), appSettings.order_cutoff, serverOffsetMs);
      }
      const dayDateStr = getDateStrForDayOfWeek(currentWeeklyMenu.week_start, day);
      return checkDayDeadline(dayDateStr, appSettings.order_cutoff, serverOffsetMs);
    },
    [currentWeeklyMenu?.week_start, appSettings.order_cutoff, serverOffsetMs]
  );

  const reloadOrders = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data } = await client.from('orders').select('id, user_id, menu_item_id, quantity, updated_at');
      if (data) setOrders(data);
    } catch (err) {
      console.warn('Lỗi reloadOrders:', err);
    }
  }, []);

  // Upsert Order (with debounce to prevent rapid API spam)
  const upsertOrder = async (menuItemId: string, quantity: number) => {
    if (!currentUser) return;
    const userId = currentUser.id;

    // Optimistic UI update
    setOrders((prev) => {
      if (quantity <= 0) {
        return prev.filter((o) => !(o.user_id === userId && o.menu_item_id === menuItemId));
      }
      const exists = prev.find((o) => o.user_id === userId && o.menu_item_id === menuItemId);
      if (exists) {
        return prev.map((o) =>
          o.user_id === userId && o.menu_item_id === menuItemId
            ? { ...o, quantity, updated_at: new Date().toISOString() }
            : o
        );
      }
      return [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          user_id: userId,
          menu_item_id: menuItemId,
          quantity,
          updated_at: new Date().toISOString(),
        },
      ];
    });

    // Debounce actual server request
    const debounceKey = `${userId}_${menuItemId}`;
    if (debounceTimers.current.has(debounceKey)) {
      clearTimeout(debounceTimers.current.get(debounceKey)!);
    }

    const timer = setTimeout(async () => {
      debounceTimers.current.delete(debounceKey);
      const client = getSupabaseClient();
      if (!client) return;

      try {
        if (quantity > 0) {
          const { error } = await client
            .from('orders')
            .upsert(
              {
                user_id: userId,
                menu_item_id: menuItemId,
                quantity: quantity,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,menu_item_id' }
            );
          // nhánh upsert (quantity > 0)
if (error) {
  console.error('Lỗi upsert đơn hàng:', error);
  if (String(error.message || '').includes('ORDER_DEADLINE_PASSED')) {
    showToast('Đã quá giờ chốt đặt món của ngày này', 'error');
  } else {
    showToast('Lỗi cập nhật suất ăn trên máy chủ!', 'error');
  }
  await reloadOrders(); // hoàn tác thay đổi tạm trên giao diện
}
        } else {
          const { error } = await client
            .from('orders')
            .delete()
            .match({ user_id: userId, menu_item_id: menuItemId });
          // nhánh delete (quantity <= 0)
if (error) {
  console.error('Lỗi xóa đơn hàng:', error);
  if (String(error.message || '').includes('ORDER_DEADLINE_PASSED')) {
    showToast('Đã quá giờ chốt đặt món của ngày này', 'error');
  } else {
    showToast('Lỗi hủy món trên máy chủ!', 'error');
  }
  await reloadOrders();
}
        }
      } catch (err: any) {
        console.error('Lỗi gọi API đặt món:', err);
      }
    }, 450);

    debounceTimers.current.set(debounceKey, timer);
  };

  // Submit feedback
  const submitFeedback = async (
    menuItemId: string | undefined,
    rating: number,
    comment: string
  ): Promise<boolean> => {
    if (!currentUser) return false;
    if (!menuItemId) {
      showToast('Vui lòng chọn món ăn để đánh giá', 'error');
      return false;
    }
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client
          .from('feedback')
          .insert({
            user_id: currentUser.id,
            menu_item_id: menuItemId,
            rating,
            comment,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setFeedbacks((prev) => [data, ...prev]);
        }
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để gửi phản hồi.');
      }
      showToast('Đã gửi phản hồi thành công. Cảm ơn bạn!', 'success');
      return true;
    } catch (err: any) {
      console.error('Lỗi gửi feedback:', err);
      showToast('Lỗi khi gửi phản hồi: ' + (err.message || ''), 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Refresh Kitchen Summary
  const refreshKitchenSummary = async () => {
    const targetMenuId = currentWeeklyMenu?.id;
    if (!targetMenuId) return;

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('kitchen_summary')
        .select('weekly_menu_id, week_start, menu_item_id, day_of_week, item_name, total_quantity')
        .eq('weekly_menu_id', targetMenuId);
      if (error) {
        console.warn('Lỗi lấy kitchen_summary:', error);
      } else if (data) {
        setKitchenSummary(data);
      }
    }
    setLastKitchenUpdate(new Date());
  };

  // Refresh Payment Admin List
  const refreshAdminPayments = async () => {
    const targetMenuId = currentWeeklyMenu?.id;
    if (!targetMenuId) return;

    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('payment_status_admin')
        .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at');
      if (error) {
        console.warn('Lỗi lấy payment_status_admin:', error);
      } else if (data) {
        setPaymentAdminList(data);
      }
    }
  };

  // Admin: Create Weekly Menu
  const createWeeklyMenu = async (weekStart: string): Promise<WeeklyMenu | null> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      let created: WeeklyMenu | null = null;
      if (client) {
        const { data, error } = await client
          .from('weekly_menus')
          .insert({
            week_start: weekStart,
            created_by: currentUser?.id || null,
          })
          .select()
          .single();
        if (error) throw error;
        created = data;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để tạo thực đơn.');
      }

      if (created) {
        setWeeklyMenus((prev) => [created!, ...prev]);
        setCurrentWeeklyMenu(created);
        showToast(`Đã tạo thực đơn mới cho tuần ${weekStart}`, 'success');
      }
      return created;
    } catch (err: any) {
      if (
        err?.code === '23505' ||
        (err?.message && String(err.message).toLowerCase().includes('unique')) ||
        (err?.details && String(err.details).toLowerCase().includes('already exists'))
      ) {
        showToast('Đã có thực đơn cho tuần này rồi, không thể tạo trùng.', 'error');
      } else {
        showToast('Lỗi tạo menu tuần: ' + err.message, 'error');
      }
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Lock Weekly Menu
  const lockWeeklyMenu = async (menuId: string) => {
    setActionLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('weekly_menus')
          .update({ locked_at: nowIso })
          .eq('id', menuId);
        if (error) throw error;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để khóa thực đơn.');
      }

      setWeeklyMenus((prev) =>
        prev.map((m) => (m.id === menuId ? { ...m, locked_at: nowIso } : m))
      );
      if (currentWeeklyMenu?.id === menuId) {
        setCurrentWeeklyMenu((prev) => (prev ? { ...prev, locked_at: nowIso } : null));
      }
      showToast('Đã khóa thực đơn tuần này!', 'success');
    } catch (err: any) {
      showToast('Lỗi khóa menu: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Add Menu Item
  const addMenuItem = async (item: {
    weekly_menu_id: string;
    day_of_week: DayOfWeek;
    name: string;
    price: number;
  }): Promise<MenuItem | null> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      let newItem: MenuItem | null = null;
      if (client) {
        const { data, error } = await client
          .from('menu_items')
          .insert({
            weekly_menu_id: item.weekly_menu_id,
            day_of_week: item.day_of_week,
            name: item.name,
            price: Math.round(item.price),
          })
          .select()
          .single();
        if (error) throw error;
        newItem = data;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để thêm món ăn.');
      }

      if (newItem) {
        setMenuItems((prev) => [...prev, newItem!]);
        showToast(`Đã thêm món "${newItem.name}"`, 'success');
        refreshKitchenSummary();
      }
      return newItem;
    } catch (err: any) {
      showToast('Lỗi thêm món ăn: ' + err.message, 'error');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Delete Menu Item
  const deleteMenuItem = async (itemId: string) => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client.from('menu_items').delete().eq('id', itemId);
        if (error) throw error;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để xóa món ăn.');
      }

      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
      showToast('Đã xóa món ăn', 'info');
      refreshKitchenSummary();
    } catch (err: any) {
      if (
        err?.code === '23503' ||
        (err?.message && String(err.message).toLowerCase().includes('foreign key'))
      ) {
        showToast(
          'Không thể xóa món này vì đã có người đặt. Nếu cần xóa, hãy xử lý các đơn hàng liên quan trước.',
          'error'
        );
      } else {
        showToast('Lỗi xóa món: ' + err.message, 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Admin & Kitchen: Toggle Menu Item Closed/Open
  const toggleMenuItemClosed = async (itemId: string, closed: boolean): Promise<boolean> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('menu_items')
          .update({ is_closed: closed })
          .eq('id', itemId);
        if (error) throw error;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để cập nhật trạng thái món.');
      }

      setMenuItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, is_closed: closed } : i))
      );
      showToast(
        closed ? 'Đã đóng nhận đặt món này' : 'Đã mở lại nhận đặt món này',
        'success'
      );
      return true;
    } catch (err: any) {
      console.error('Lỗi đóng/mở món:', err);
      showToast('Lỗi cập nhật trạng thái món: ' + (err.message || ''), 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Call RPC generate_payments(weekly_menu_id)
  const generateWeeklyPayments = async (weeklyMenuId: string): Promise<number> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        let res = await client.rpc('generate_payments', {
          p_weekly_menu_id: weeklyMenuId,
        });
        if (res.error && res.error.message.includes('Could not find')) {
          res = await client.rpc('generate_payments', {
            weekly_menu_id: weeklyMenuId,
          });
        }
        if (res.error) throw res.error;

        showToast('Đã chốt đơn và tạo hóa đơn tuần thành công!', 'success');
        await refreshAdminPayments();
        return Number(res.data) || 1;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để chốt hóa đơn.');
      }
    } catch (err: any) {
      console.error('Lỗi generate_payments:', err);
      showToast('Lỗi tạo hóa đơn: ' + err.message, 'error');
      return 0;
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Call RPC confirm_payment(payment_id, confirmed_by)
  const confirmCashPayment = async (paymentId: string): Promise<boolean> => {
    setActionLoading(true);
    const adminName = currentUser?.name || 'Admin';
    try {
      const client = getSupabaseClient();
      if (client) {
        let res = await client.rpc('confirm_payment', {
          p_payment_id: paymentId,
          p_confirmed_by: adminName,
        });
        if (res.error && res.error.message.includes('Could not find')) {
          res = await client.rpc('confirm_payment', {
            payment_id: paymentId,
            confirmed_by: adminName,
          });
        }
        if (res.error) throw res.error;
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để xác nhận thanh toán.');
      }

      showToast('Đã xác nhận thanh toán thành công!', 'success');
      if (client) {
        const { data: pData } = await client
          .from('payments')
          .select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref');
        if (pData) setPayments(pData);
      }
      await refreshAdminPayments();
      return true;
    } catch (err: any) {
      console.error('Lỗi confirm_payment:', err);
      showToast('Lỗi xác nhận thanh toán: ' + err.message, 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Employee: Mark payment as pending ("Tôi đã chuyển khoản")
  const requestPaymentConfirmation = async (weeklyMenuId: string, amountDue: number): Promise<boolean> => {
    if (!currentUser) return false;
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        // Check if row already exists for this user and weeklyMenuId
        const { data: existingPay, error: checkErr } = await client
          .from('payments')
          .select('id, amount_due, status')
          .eq('user_id', currentUser.id)
          .eq('weekly_menu_id', weeklyMenuId)
          .maybeSingle();

        if (checkErr && !checkErr.message.includes('multiple (or no) rows')) {
          console.warn('Lỗi kiểm tra payments:', checkErr);
        }

        if (existingPay?.id) {
          const { error: updErr } = await client
            .from('payments')
            .update({
              status: 'pending',
              method: 'transfer',
              amount_due: existingPay.amount_due > 0 ? existingPay.amount_due : amountDue,
            })
            .eq('id', existingPay.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await client
            .from('payments')
            .insert({
              user_id: currentUser.id,
              weekly_menu_id: weeklyMenuId,
              amount_due: amountDue,
              status: 'pending',
              method: 'transfer',
            });
          if (insErr) throw insErr;
        }

        // Fetch refreshed payments & admin view
        const { data: pData } = await client
          .from('payments')
          .select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref');
        if (pData) setPayments(pData);
        await refreshAdminPayments();
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để gửi thông báo chuyển khoản.');
      }

      showToast('Đã gửi thông báo đã chuyển khoản! Vui lòng chờ Admin xác nhận.', 'success');
      return true;
    } catch (err: any) {
      console.error('Lỗi requestPaymentConfirmation:', err);
      showToast('Lỗi cập nhật trạng thái thanh toán: ' + (err.message || ''), 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Reject payment (set status back to 'unpaid')
  const rejectPaymentConfirmation = async (paymentId: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('payments')
          .update({
            status: 'unpaid',
            confirmed_by: null,
            confirmed_at: null,
          })
          .eq('id', paymentId);
        if (error) throw error;

        const { data: pData } = await client
          .from('payments')
          .select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref');
        if (pData) setPayments(pData);
        await refreshAdminPayments();
      } else {
        throw new Error('Không có kết nối đến máy chủ Supabase để từ chối thanh toán.');
      }

      showToast('Đã từ chối xác nhận (trạng thái chuyển về Chưa thanh toán)', 'info');
      return true;
    } catch (err: any) {
      console.error('Lỗi rejectPaymentConfirmation:', err);
      showToast('Lỗi từ chối thanh toán: ' + (err.message || ''), 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Get monthly revenue for a given month (YYYY-MM) with detailed weekly paid payments
  const getMonthlyRevenue = useCallback(
    async (
      month: string
    ): Promise<{
      totalRevenue: number;
      hasWeeks: boolean;
      weekCount: number;
      weeksData: Array<{
        weeklyMenu: WeeklyMenu;
        paidPayments: Array<{
          id: string;
          user_id: string;
          weekly_menu_id: string;
          name: string;
          transfer_code: string | null;
          amount_due: number;
          confirmed_at: string | null;
          confirmed_by?: string | null;
        }>;
      }>;
    }> => {
      // 1. Tìm các tuần có week_start trong tháng
      const matchingMenus = weeklyMenus
        .filter((m) => {
          if (!m.week_start) return false;
          const cleanDate = m.week_start.split('T')[0].trim();
          return cleanDate.startsWith(month);
        })
        .sort((a, b) => (a.week_start > b.week_start ? 1 : -1));

      if (matchingMenus.length === 0) {
        return { totalRevenue: 0, hasWeeks: false, weekCount: 0, weeksData: [] };
      }

      const menuIds = matchingMenus.map((m) => m.id);
      const client = getSupabaseClient();
      const allUsers = users;
      const userMap = new Map<string, any>(allUsers.map((u) => [u.id, u]));

      if (client) {
        let data: any[] | null = null;
        const { data: joinedData, error: joinErr } = await client
          .from('payments')
          .select(`
            id,
            user_id,
            weekly_menu_id,
            amount_due,
            status,
            method,
            confirmed_by,
            confirmed_at,
            bank_ref,
            users (
              id,
              name,
              transfer_code
            )
          `)
          .in('weekly_menu_id', menuIds);

        if (joinErr || !joinedData) {
          const { data: simpleData } = await client
            .from('payments')
            .select('id, user_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at, bank_ref')
            .in('weekly_menu_id', menuIds);
          data = simpleData;
        } else {
          data = joinedData;
        }

        if (data) {
          // Cập nhật lại payments state nếu có thay đổi để đồng bộ
          setPayments((prev) => {
            let hasDiff = false;
            const map = new Map<string, Payment>(prev.map((p) => [p.id, p]));
            data!.forEach((d: any) => {
              const existing = map.get(d.id);
              const u = d.users || userMap.get(d.user_id);
              if (
                !existing ||
                existing.status !== d.status ||
                existing.amount_due !== d.amount_due ||
                existing.confirmed_at !== d.confirmed_at ||
                existing.confirmed_by !== d.confirmed_by ||
                existing.method !== d.method
              ) {
                hasDiff = true;
              }
              map.set(d.id, {
                id: d.id,
                user_id: d.user_id,
                weekly_menu_id: d.weekly_menu_id,
                amount_due: d.amount_due,
                status: d.status,
                method: d.method,
                confirmed_by: d.confirmed_by,
                confirmed_at: d.confirmed_at,
                bank_ref: d.bank_ref,
                user: u,
              });
            });
            return hasDiff ? Array.from(map.values()) : prev;
          });

          const paidList = data.filter((p: any) => p.status === 'paid');
          const totalRevenue = paidList.reduce((sum: number, p: any) => sum + (Number(p.amount_due) || 0), 0);

          const weeksData = matchingMenus.map((menu) => {
            const paidPayments = data!
              .filter((p: any) => p.weekly_menu_id === menu.id && p.status === 'paid')
              .map((p: any) => {
                const u = p.users || userMap.get(p.user_id);
                return {
                  id: p.id,
                  user_id: p.user_id,
                  weekly_menu_id: p.weekly_menu_id,
                  name: u?.name || 'Nhân viên',
                  transfer_code: u?.transfer_code || null,
                  amount_due: Number(p.amount_due) || 0,
                  confirmed_at: p.confirmed_at || null,
                  confirmed_by: p.confirmed_by || null,
                };
              });
            return {
              weeklyMenu: menu,
              paidPayments,
            };
          });

          return { totalRevenue, hasWeeks: true, weekCount: matchingMenus.length, weeksData };
        }
      }

      return { totalRevenue: 0, hasWeeks: true, weekCount: matchingMenus.length, weeksData: [] };
    },
    [weeklyMenus, users]
  );

  // Save Supabase credentials (disabled in production since config is fixed)
  const saveSupabaseConfig = async (
    _url: string,
    _key: string
  ): Promise<{ success: boolean; message: string }> => {
    return {
      success: false,
      message: 'Cấu hình Supabase đã được cố định theo biến môi trường/supabaseConfig.ts.',
    };
  };

  const disconnectSupabase = () => {
    showToast('Ứng dụng đang chạy ở bản Production với kết nối Supabase cố định.', 'info');
  };

  const resetDemoData = () => {
    showToast('Chế độ dữ liệu mẫu đã bị tắt ở bản Production.', 'info');
  };

  // Explicitly reload data from Supabase
  const refreshData = async (): Promise<void> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        const ok = await loadSupabaseData(client);
        if (ok) {
          showToast('Đã tải và cập nhật dữ liệu mới nhất từ Supabase!', 'success');
        } else {
          showToast('Không thể tải dữ liệu. Vui lòng kiểm tra quyền RLS hoặc kết nối.', 'error');
        }
      } else {
        await retryConnection();
      }
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi tải lại dữ liệu', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Seed sample users & current week menu directly into Supabase
  const seedSupabaseDatabase = async (): Promise<boolean> => {
    setActionLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Chưa kết nối Supabase client');

      // 0. Check if users already exist on Supabase
      const { data: existingUsers, error: checkErr } = await client
        .from('users')
        .select('id, name')
        .limit(1);

      if (!checkErr && existingUsers && existingUsers.length > 0) {
        await loadSupabaseData(client);
        showToast('Dữ liệu đã có sẵn trên Supabase, đã đồng bộ thành công!', 'success');
        return true;
      }

      // 1. Insert initial users
      const { data: createdUsers, error: uErr } = await client.from('users').insert([
        { name: 'Admin Test', department: 'Vận hành', role: 'admin', transfer_code: null },
        { name: 'Bếp Test', department: 'Bếp', role: 'kitchen', transfer_code: null },
        { name: 'Nguyễn Văn A', department: 'Kinh doanh', role: 'staff', transfer_code: 'U001' },
        { name: 'Trần Thị B', department: 'Kỹ thuật', role: 'staff', transfer_code: 'U002' },
        { name: 'Lê Văn C', department: 'Kỹ thuật', role: 'staff', transfer_code: 'U003' },
        { name: 'Phạm Thị D', department: 'Nhân sự', role: 'staff', transfer_code: 'U004' },
        { name: 'Hoàng Văn E', department: 'Kinh doanh', role: 'staff', transfer_code: 'U005' },
      ]).select();

      if (uErr) {
        if (uErr.code === '42501') {
          throw new Error('Supabase RLS đang chặn ghi dữ liệu (mã 42501). Hãy mở nút "Mã SQL & RLS" > Chọn tab "Sửa lỗi RLS 42501" và chạy trên Supabase SQL Editor.');
        }
        throw uErr;
      }

      // 2. Create weekly menu for current week
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mondayDate = new Date(d.setDate(diff)).toISOString().split('T')[0];

      const adminUser = createdUsers?.find((u) => u.role === 'admin') || createdUsers?.[0];

      const { data: newMenu, error: mErr } = await client.from('weekly_menus').insert({
        week_start: mondayDate,
        created_by: adminUser?.id || null,
      }).select().single();

      if (newMenu && !mErr) {
        // 3. Insert dishes (2 dishes/day, VND prices from user seed script)
        const sampleDishes = [
          { weekly_menu_id: newMenu.id, day_of_week: 'monday', name: 'Cơm sườn nướng', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'monday', name: 'Cơm gà xối mỡ', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'tuesday', name: 'Bún bò Huế', price: 40000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'tuesday', name: 'Cơm cá kho tộ', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'wednesday', name: 'Cơm tấm bì chả', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'wednesday', name: 'Phở bò', price: 40000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'thursday', name: 'Cơm gà chiên nước mắm', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'thursday', name: 'Bún riêu', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'friday', name: 'Cơm sườn bì chả', price: 35000 },
          { weekly_menu_id: newMenu.id, day_of_week: 'friday', name: 'Mì xào hải sản', price: 40000 },
        ];
        await client.from('menu_items').insert(sampleDishes);
      }

      await loadSupabaseData(client);
      showToast('Đã nạp dữ liệu mẫu vào Supabase của bạn thành công!', 'success');
      return true;
    } catch (err: any) {
      console.error('Lỗi seed Supabase:', err);
      showToast(err.message || 'Lỗi nạp dữ liệu mẫu', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        users,
        currentUser,
        activeRole,
        weeklyMenus,
        currentWeeklyMenu,
        menuItems,
        orders,
        payments,
        kitchenSummary,
        paymentAdminList,
        feedbacks,
        loading,
        actionLoading,
        isSupabaseLive,
        connectionError,
        retryConnection,
        appSettings,
        serverOffsetMs,
        syncServerNow,
        setOrderCutoff,
        getDeadlineForDay,
        reloadOrders,
        lastKitchenUpdate,
        toastMessage,
        claimProfile,
        registerAndClaim,
        signInWithGoogleAdmin,
        logout,
        switchUser,
        setActiveRole,
        upsertOrder,
        submitFeedback,
        refreshKitchenSummary,
        refreshAdminPayments,
        createWeeklyMenu,
        lockWeeklyMenu,
        addMenuItem,
        deleteMenuItem,
        toggleMenuItemClosed,
        generateWeeklyPayments,
        confirmCashPayment,
        requestPaymentConfirmation,
        rejectPaymentConfirmation,
        getMonthlyRevenue,
        lastSeenFeedbackAt,
        markFeedbacksAsSeen,
        hasUnseenFeedback,
        refreshData,
        seedSupabaseDatabase,
        saveSupabaseConfig,
        disconnectSupabase,
        resetDemoData,
        showToast,
      }}
    >
      {children}
      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 max-w-sm transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-800'
              : toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-800'
              : 'bg-stone-900 text-white border-stone-800'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp phải được sử dụng bên trong AppProvider');
  }
  return context;
};

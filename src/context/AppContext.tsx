import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
} from '../types/database';
import {
  getSupabaseClient,
  getSupabaseCredentials,
  saveCustomSupabaseCredentials,
  clearCustomSupabaseCredentials,
  localLunchEngine,
  STORAGE_CLAIMED_USER_ID,
  STORAGE_CLAIMED_ROLE,
  INITIAL_USERS,
  INITIAL_WEEKLY_MENU,
} from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  lastKitchenUpdate: Date | null;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;

  // Authentication & Profile claiming
  claimProfile: (targetUserId: string) => Promise<boolean>;
  registerAndClaim: (name: string, department: string, role?: UserRole) => Promise<boolean>;
  switchUser: () => void;
  setActiveRole: (role: UserRole) => void;

  // Employee actions
  upsertOrder: (menuItemId: string, quantity: number) => Promise<void>;
  submitFeedback: (menuItemId: string | undefined, rating: number, comment: string) => Promise<boolean>;

  // Kitchen actions
  refreshKitchenSummary: () => Promise<void>;

  // Admin actions
  refreshAdminPayments: () => Promise<void>;
  createWeeklyMenu: (weekStart: string) => Promise<WeeklyMenu | null>;
  lockWeeklyMenu: (menuId: string) => Promise<void>;
  addMenuItem: (item: { weekly_menu_id: string; day_of_week: DayOfWeek; name: string; price: number }) => Promise<MenuItem | null>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  generateWeeklyPayments: (weeklyMenuId: string) => Promise<number>;
  confirmCashPayment: (paymentId: string) => Promise<boolean>;

  // Supabase Config
  refreshData: () => Promise<void>;
  seedSupabaseDatabase: () => Promise<boolean>;
  saveSupabaseConfig: (url: string, key: string) => Promise<{ success: boolean; message: string }>;
  disconnectSupabase: () => void;
  resetDemoData: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConfigured } = getSupabaseCredentials();
  const [users, setUsers] = useState<User[]>(() => (isConfigured ? [] : INITIAL_USERS));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);

  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>(() => (isConfigured ? [] : [INITIAL_WEEKLY_MENU]));
  const [currentWeeklyMenu, setCurrentWeeklyMenu] = useState<WeeklyMenu | null>(() => (isConfigured ? null : INITIAL_WEEKLY_MENU));
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [kitchenSummary, setKitchenSummary] = useState<KitchenSummaryRow[]>([]);
  const [paymentAdminList, setPaymentAdminList] = useState<PaymentStatusAdminRow[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState(false);
  const [lastKitchenUpdate, setLastKitchenUpdate] = useState<Date | null>(new Date());
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Sync data from Local Engine
  const loadLocalState = useCallback(() => {
    const localUsers = localLunchEngine.getUsers();
    const localMenus = localLunchEngine.getWeeklyMenus();
    const localItems = localLunchEngine.getMenuItems();
    const localOrders = localLunchEngine.getOrders();
    const localPayments = localLunchEngine.getPayments();
    const localFeedbacks = localLunchEngine.getFeedbacks();

    setUsers(localUsers);
    setWeeklyMenus(localMenus);
    const activeMenu = localMenus[0] || null;
    setCurrentWeeklyMenu(activeMenu);

    if (activeMenu) {
      setMenuItems(localItems.filter((i) => i.weekly_menu_id === activeMenu.id));
      setKitchenSummary(localLunchEngine.getKitchenSummary(activeMenu.id));
      setPaymentAdminList(localLunchEngine.getPaymentStatusAdmin(activeMenu.id));
    } else {
      setMenuItems(localItems);
    }

    setOrders(localOrders);
    setPayments(localPayments);
    setFeedbacks(localFeedbacks);
    setLastKitchenUpdate(new Date());
  }, []);

  // Fetch real data from Supabase client
  const loadSupabaseData = useCallback(async (client: ReturnType<typeof getSupabaseClient>) => {
    if (!client) return false;
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
        console.warn('Lỗi lấy bảng users:', userErr);
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
        console.warn('Lỗi lấy weekly_menus:', menuErr);
      } else if (menuData && menuData.length > 0) {
        setWeeklyMenus(menuData);
        targetMenu = menuData[0];
        setCurrentWeeklyMenu(targetMenu);
      }

      // 3. Fetch menu items for current weekly menu
      if (targetMenu) {
        const { data: itemsData, error: itemErr } = await client
          .from('menu_items')
          .select('id, weekly_menu_id, day_of_week, name, price')
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
          .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at')
          .eq('weekly_menu_id', targetMenu.id);
        if (!pErr && payAdminData) {
          setPaymentAdminList(payAdminData);
        }
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

      setIsSupabaseLive(true);
      return true;
    } catch (err: any) {
      console.error('Không thể tải dữ liệu Supabase:', err);
      setIsSupabaseLive(false);
      loadLocalState();
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadLocalState]);

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
                .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at')
                .eq('weekly_menu_id', currentMenuId);
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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Đã kết nối Supabase Realtime thành công trên bảng orders');
          }
        });

      channelRef.current = channel;
    } catch (err) {
      console.warn('Lỗi đăng ký Realtime Supabase:', err);
    }
  }, [currentWeeklyMenu?.id]);

  // Initial Boot
  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      setLoading(true);
      const client = getSupabaseClient();

      if (client) {
        // Step 1: Ensure Anonymous Auth Session
        try {
          const { data: sessionData } = await client.auth.getSession();
          if (!sessionData.session) {
            const { error: anonErr } = await client.auth.signInAnonymously();
            if (anonErr) console.warn('Lưu ý Anonymous Auth:', anonErr.message);
          }
        } catch (authErr) {
          console.warn('Supabase Auth check:', authErr);
        }

        const ok = await loadSupabaseData(client);
        if (ok) {
          setupRealtimeSubscription(client);
        }
      } else {
        loadLocalState();
        setIsSupabaseLive(false);
      }

      // Check stored user profile
      const storedUserId = localStorage.getItem(STORAGE_CLAIMED_USER_ID);
      const storedRole = localStorage.getItem(STORAGE_CLAIMED_ROLE) as UserRole | null;

      if (storedUserId) {
        let found: User | undefined;
        if (client) {
          const { data: userData } = await client
            .from('users')
            .select('id, name, department, role, transfer_code, auth_uid, created_at')
            .eq('id', storedUserId)
            .single();
          if (userData) found = userData;
        }

        if (!found) {
          if (!client) {
            found = localLunchEngine.getUsers().find((u) => u.id === storedUserId);
          } else {
            // Stored user ID was from demo/local mock, clear it to prevent phantom user
            localStorage.removeItem(STORAGE_CLAIMED_USER_ID);
            localStorage.removeItem(STORAGE_CLAIMED_ROLE);
          }
        }

        if (found) {
          setCurrentUser(found);
          setActiveRole(storedRole || found.role);

          if (client) {
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

    const unsubscribeLocal = localLunchEngine.subscribe(() => {
      if (!isSupabaseLive) {
        loadLocalState();
      }
    });

    return () => {
      isMounted = false;
      unsubscribeLocal();
      if (channelRef.current && getSupabaseClient()) {
        getSupabaseClient()?.removeChannel(channelRef.current);
      }
    };
  }, [loadLocalState, loadSupabaseData, setupRealtimeSubscription, isSupabaseLive]);

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
              throw new Error('Chính sách RLS của Supabase đang chặn thêm tài khoản (mã 42501). Hãy mở Supabase Dashboard > SQL Editor để chạy script mở quyền (bấm nút "Cấu hình Supabase" ở góc trên để lấy câu lệnh SQL).');
            }
            throw insErr;
          }
          newUser = insertedUser;
        }
      } else {
        newUser = localLunchEngine.registerAndClaim(name.trim(), department.trim() || null, role);
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

  const switchUser = () => {
    localStorage.removeItem(STORAGE_CLAIMED_USER_ID);
    localStorage.removeItem(STORAGE_CLAIMED_ROLE);
    setCurrentUser(null);
    setActiveRole(null);
  };

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

    localLunchEngine.upsertOrder(userId, menuItemId, quantity);

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
          if (error) {
            console.error('Lỗi upsert đơn hàng:', error);
            showToast('Lỗi cập nhật suất ăn trên máy chủ!', 'error');
          }
        } else {
          const { error } = await client
            .from('orders')
            .delete()
            .match({ user_id: userId, menu_item_id: menuItemId });
          if (error) {
            console.error('Lỗi xóa đơn hàng:', error);
            showToast('Lỗi hủy món trên máy chủ!', 'error');
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
        const newFb = localLunchEngine.addFeedback({
          user_id: currentUser.id,
          menu_item_id: menuItemId,
          rating,
          comment,
        });
        setFeedbacks((prev) => [newFb, ...prev]);
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
    } else {
      setKitchenSummary(localLunchEngine.getKitchenSummary(targetMenuId));
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
        .select('user_id, name, department, transfer_code, payment_id, weekly_menu_id, amount_due, status, method, confirmed_by, confirmed_at')
        .eq('weekly_menu_id', targetMenuId);
      if (error) {
        console.warn('Lỗi lấy payment_status_admin:', error);
      } else if (data) {
        setPaymentAdminList(data);
      }
    } else {
      setPaymentAdminList(localLunchEngine.getPaymentStatusAdmin(targetMenuId));
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
        created = localLunchEngine.createWeeklyMenu(weekStart, currentUser?.id || 'admin');
      }

      if (created) {
        setWeeklyMenus((prev) => [created!, ...prev]);
        setCurrentWeeklyMenu(created);
        showToast(`Đã tạo thực đơn mới cho tuần ${weekStart}`, 'success');
      }
      return created;
    } catch (err: any) {
      showToast('Lỗi tạo menu tuần: ' + err.message, 'error');
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
        localLunchEngine.lockWeeklyMenu(menuId);
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
        newItem = localLunchEngine.addMenuItem(item);
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
        localLunchEngine.deleteMenuItem(itemId);
      }

      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
      showToast('Đã xóa món ăn', 'info');
      refreshKitchenSummary();
    } catch (err: any) {
      showToast('Lỗi xóa món: ' + err.message, 'error');
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
        const res = localLunchEngine.generatePayments(weeklyMenuId);
        showToast(`Đã chốt đơn và tạo ${res.count} hóa đơn tuần!`, 'success');
        await refreshAdminPayments();
        return res.count;
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
        const ok = localLunchEngine.confirmPayment(paymentId, adminName);
        if (!ok) throw new Error('Không tìm thấy hóa đơn');
      }

      showToast('Đã xác nhận thanh toán tiền mặt thành công!', 'success');
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

  // Save Supabase credentials & reload live data
  const saveSupabaseConfig = async (
    url: string,
    key: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      saveCustomSupabaseCredentials(url, key);
      const client = getSupabaseClient();
      if (!client) {
        return {
          success: false,
          message: 'Thông tin URL hoặc Anon Key chưa đúng định dạng.',
        };
      }

      const ok = await loadSupabaseData(client);
      if (ok) {
        setupRealtimeSubscription(client);
        return {
          success: true,
          message: 'Kết nối Supabase thành công! Dữ liệu đã đồng bộ thời gian thực.',
        };
      } else {
        return {
          success: false,
          message: 'Không thể truy vấn bảng Supabase. Vui lòng kiểm tra quyền RLS hoặc Key.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: 'Lỗi cấu hình: ' + (err?.message || ''),
      };
    }
  };

  const disconnectSupabase = () => {
    clearCustomSupabaseCredentials();
    setIsSupabaseLive(false);
    loadLocalState();
    showToast('Đã ngắt kết nối Supabase và chuyển về chế độ offline/mô phỏng.', 'info');
  };

  const resetDemoData = () => {
    localLunchEngine.resetDemoData();
    loadLocalState();
    showToast('Đã đặt lại dữ liệu cục bộ ban đầu.', 'info');
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
          showToast('Không thể tải dữ liệu. Vui lòng kiểm tra quyền RLS.', 'error');
        }
      } else {
        loadLocalState();
        showToast('Đã làm mới dữ liệu offline.', 'info');
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
        lastKitchenUpdate,
        toastMessage,
        claimProfile,
        registerAndClaim,
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
        generateWeeklyPayments,
        confirmCashPayment,
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

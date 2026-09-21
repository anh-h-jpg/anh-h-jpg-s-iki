import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DayOfWeek, MenuItem, PaymentStatusAdminRow, DAYS_OF_WEEK } from '../types/database';
import { formatVND, DAY_NAMES, formatWeekTitle, formatConfirmedAtDate } from '../utils/formatters';
import { KitchenView } from './KitchenView';
import { ExcelImportModal } from './ExcelImportModal';
import {
  Calendar,
  Plus,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  DollarSign,
  Utensils,
  Star,
  MessageSquare,
  ChefHat,
  FileSpreadsheet,
  Clock,
  Check,
  X,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    users,
    weeklyMenus,
    currentWeeklyMenu,
    menuItems,
    orders,
    payments,
    paymentAdminList,
    feedbacks,
    actionLoading,
    createWeeklyMenu,
    lockWeeklyMenu,
    addMenuItem,
    deleteMenuItem,
    toggleMenuItemClosed,
    generateWeeklyPayments,
    confirmCashPayment,
    rejectPaymentConfirmation,
    getMonthlyRevenue,
    markFeedbacksAsSeen,
    hasUnseenFeedback,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'menu' | 'payments' | 'feedbacks' | 'kitchen'>('menu');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');

  // Excel Import Modal
  const [showExcelModal, setShowExcelModal] = useState(false);

  // New Menu Form
  const [showNewMenuModal, setShowNewMenuModal] = useState(false);
  const [newMenuWeekStart, setNewMenuWeekStart] = useState('');

  // Add Item Form
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('36000');
  const [newItemDay, setNewItemDay] = useState<DayOfWeek>('monday');

  // Helper to open manual add item modal with default price 36000
  const openAddDishModal = (day: DayOfWeek) => {
    setNewItemDay(day);
    setNewItemName('');
    setNewItemPrice('36000');
    setShowAddItemModal(true);
  };

  // Payment Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'pending'>('all');
  const [paymentSearch, setPaymentSearch] = useState('');

  // Helper lấy tháng hiện tại dạng YYYY-MM
  const getCurrentMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // State chọn tháng cho khối Doanh Thu
  const [selectedRevenueMonth, setSelectedRevenueMonth] = useState<string>(getCurrentMonthStr);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<{
    totalRevenue: number;
    hasWeeks: boolean;
    weekCount: number;
    weeksData?: Array<{
      weeklyMenu: any;
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
  }>({ totalRevenue: 0, hasWeeks: false, weekCount: 0, weeksData: [] });

  // Kiểm tra ngày bắt đầu tuần có thuộc tháng đang chọn không
  const isWeekInSelectedMonth = (weekStart: string, monthStr: string): boolean => {
    if (!weekStart || !monthStr) return false;
    const cleanDate = weekStart.split('T')[0].trim();
    if (cleanDate.startsWith(monthStr)) return true;
    const d = new Date(weekStart);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}` === monthStr;
    }
    return false;
  };

  // Danh sách các tuần thực đơn trong tháng đang chọn, sắp xếp theo thứ tự tuần gần nhất trước (descending) hoặc tăng dần
  const weeksInSelectedMonth = useMemo(() => {
    return weeklyMenus
      .filter((m) => isWeekInSelectedMonth(m.week_start, selectedRevenueMonth))
      .sort((a, b) => (b.week_start || '').localeCompare(a.week_start || ''));
  }, [weeklyMenus, selectedRevenueMonth]);

  // ID tuần mới nhất (gần nhất) trong danh sách đang xem
  const latestWeekInSelectedMonth = useMemo(() => {
    if (weeksInSelectedMonth.length === 0) return null;
    return weeksInSelectedMonth[0].id;
  }, [weeksInSelectedMonth]);

  // State quản lý việc mở/đóng accordion từng tuần: Map/Record id -> boolean
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});

  // Từ khóa tìm kiếm nhân viên trong lịch sử thanh toán các tuần
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');

  // Khi danh sách tuần thay đổi hoặc chuyển tháng, mặc định đóng tất cả trừ tuần mới nhất
  useEffect(() => {
    if (latestWeekInSelectedMonth) {
      setExpandedWeeks({ [latestWeekInSelectedMonth]: true });
    } else {
      setExpandedWeeks({});
    }
  }, [latestWeekInSelectedMonth, selectedRevenueMonth]);

  const toggleWeekAccordion = (weekId: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekId]: !prev[weekId],
    }));
  };

  const hasWeeksInMonth = weeksInSelectedMonth.length > 0;

  // Tính tổng doanh thu từ các tuần có status = 'paid' dựa trên payments trong context
  const liveMonthlyRevenue = useMemo(() => {
    if (!hasWeeksInMonth) return 0;
    const weekIds = new Set(weeksInSelectedMonth.map((w) => w.id));
    return payments
      .filter((p) => weekIds.has(p.weekly_menu_id) && p.status === 'paid')
      .reduce((sum, p) => sum + (Number(p.amount_due) || 0), 0);
  }, [weeksInSelectedMonth, hasWeeksInMonth, payments]);

  // Tự động gọi lại getMonthlyRevenue(tháng đang chọn) mỗi khi payments hoặc weeklyMenus (từ useApp()) thay đổi,
  // hoặc khi đổi tháng hay mở tab thanh toán. Giữ nguyên quy tắc chỉ cộng các dòng status = 'paid'.
  useEffect(() => {
    if (!selectedRevenueMonth) return;
    let isMounted = true;
    getMonthlyRevenue(selectedRevenueMonth).then((res) => {
      if (isMounted && res) {
        setMonthlyRevenueData(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedRevenueMonth, weeklyMenus, payments, getMonthlyRevenue]);

  // Chuỗi hiển thị tháng dạng MM/YYYY
  const displayRevenueMonth = useMemo(() => {
    if (!selectedRevenueMonth) return '';
    const parts = selectedRevenueMonth.split('-');
    if (parts.length === 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return selectedRevenueMonth;
  }, [selectedRevenueMonth]);

  // Lấy danh sách nhân viên đã thanh toán (status = 'paid') cho 1 tuần thuộc tháng đang chọn
  const getPaidPaymentsForWeek = (weekId: string) => {
    const fromFetch = monthlyRevenueData.weeksData?.find((w) => w.weeklyMenu.id === weekId);
    if (fromFetch && fromFetch.paidPayments) {
      return fromFetch.paidPayments;
    }
    return payments
      .filter((p) => p.weekly_menu_id === weekId && p.status === 'paid')
      .map((p) => {
        const u = users.find((user) => user.id === p.user_id) || (p as any).user;
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
  };

  // Đánh dấu đã xem phản hồi khi Admin mở tab feedbacks
  useEffect(() => {
    if (activeTab === 'feedbacks') {
      markFeedbacksAsSeen();
    }
  }, [activeTab, markFeedbacksAsSeen]);

  const effectiveMonthlyRevenue = Math.max(monthlyRevenueData.totalRevenue, liveMonthlyRevenue);
  const effectiveHasWeeks = hasWeeksInMonth || monthlyRevenueData.hasWeeks;

  const isMenuLocked = Boolean(currentWeeklyMenu?.locked_at);

  // Danh sách thanh toán đồng bộ:
  // - Với mỗi user có đơn hàng trong tuần hiện tại (hoặc role staff): tìm dòng payment_status_admin khớp weekly_menu_id === currentWeeklyMenu.id.
  // - Nếu KHÔNG có dòng khớp tuần hiện tại (kể cả khi user chỉ có dòng của tuần khác hoặc weekly_menu_id = null):
  //   vẫn hiển thị user đó với status mặc định 'unpaid'. Tuyệt đối không lọc bỏ user chỉ vì thiếu payments của tuần hiện tại.
  // - Giữ nguyên quy tắc số tiền: nếu chưa khóa menu (locked_at == null), tính live amount_due = tổng (orders.quantity * menuItems.price);
  //   nếu đã khóa (locked_at có giá trị), giữ nguyên amount_due từ payment row đã chốt (hoặc fallback live amount nếu payment chưa tạo).
  const effectivePaymentAdminList = useMemo((): PaymentStatusAdminRow[] => {
    if (!currentWeeklyMenu) {
      return paymentAdminList;
    }

    const currentMenuMap = new Map<string, MenuItem>(
      menuItems.filter((i) => i.weekly_menu_id === currentWeeklyMenu.id).map((i) => [i.id, i])
    );

    // Tính tổng số tiền theo đơn hàng thực tế tuần này cho từng user
    const userLiveAmountMap = new Map<string, number>();
    const usersWithOrdersThisWeek = new Set<string>();

    orders.forEach((o) => {
      const item = currentMenuMap.get(o.menu_item_id);
      if (item && o.quantity > 0) {
        usersWithOrdersThisWeek.add(o.user_id);
        userLiveAmountMap.set(
          o.user_id,
          (userLiveAmountMap.get(o.user_id) || 0) + item.price * o.quantity
        );
      }
    });

    // Gom tập hợp tất cả user cần hiển thị:
    // User có role staff HOẶC user có đơn hàng trong tuần hiện tại
    const targetUsersMap = new Map<string, (typeof users)[0]>();
    users.forEach((u) => {
      if (u.role === 'staff' || usersWithOrdersThisWeek.has(u.id)) {
        targetUsersMap.set(u.id, u);
      }
    });

    // Map các dòng payment_status_admin CHÍNH XÁC của tuần hiện tại theo user_id
    const currentWeekPaymentMap = new Map<string, PaymentStatusAdminRow>();
    paymentAdminList.forEach((row) => {
      if (row.weekly_menu_id === currentWeeklyMenu.id) {
        currentWeekPaymentMap.set(row.user_id, row);
      }
    });

    // Duyệt qua tất cả user cần hiển thị để tạo PaymentStatusAdminRow đầy đủ
    const result: PaymentStatusAdminRow[] = [];

    targetUsersMap.forEach((u, userId) => {
      const matchedRow = currentWeekPaymentMap.get(userId);
      const liveAmount = userLiveAmountMap.get(userId) || 0;

      if (matchedRow) {
        // Có dòng payment của tuần hiện tại
        const finalAmount = isMenuLocked
          ? (matchedRow.amount_due !== null && matchedRow.amount_due !== undefined ? matchedRow.amount_due : liveAmount)
          : liveAmount;

        result.push({
          ...matchedRow,
          name: matchedRow.name || u.name,
          department: matchedRow.department || u.department,
          transfer_code: matchedRow.transfer_code || u.transfer_code,
          amount_due: finalAmount,
          status: matchedRow.status || 'unpaid',
        });
      } else {
        // KHÔNG có dòng khớp tuần hiện tại: vẫn hiển thị user đó với status mặc định 'unpaid'
        result.push({
          user_id: u.id,
          name: u.name,
          department: u.department,
          transfer_code: u.transfer_code,
          payment_id: null,
          weekly_menu_id: currentWeeklyMenu.id,
          amount_due: liveAmount,
          status: 'unpaid',
          method: null,
          confirmed_by: null,
          confirmed_at: null,
        });
      }
    });

    // Bổ sung thêm bất kỳ user nào có mặt trong currentWeekPaymentMap nhưng có thể chưa nằm trong targetUsersMap
    currentWeekPaymentMap.forEach((row, userId) => {
      if (!targetUsersMap.has(userId)) {
        const liveAmount = userLiveAmountMap.get(userId) || 0;
        const finalAmount = isMenuLocked
          ? (row.amount_due !== null && row.amount_due !== undefined ? row.amount_due : liveAmount)
          : liveAmount;

        result.push({
          ...row,
          amount_due: finalAmount,
          status: row.status || 'unpaid',
        });
      }
    });

    return result;
  }, [paymentAdminList, isMenuLocked, currentWeeklyMenu, menuItems, orders, users]);

  // Filtered menu items for the current day in Admin tab
  const dayMenuItems = useMemo(() => {
    if (!currentWeeklyMenu) return [];
    return menuItems.filter(
      (item) => item.weekly_menu_id === currentWeeklyMenu.id && item.day_of_week === selectedDay
    );
  }, [menuItems, currentWeeklyMenu, selectedDay]);

  // Check if selected week_start for new menu already exists
  const isWeekAlreadyExists = useMemo(() => {
    if (!newMenuWeekStart) return false;
    return weeklyMenus.some((m) => m.week_start === newMenuWeekStart);
  }, [newMenuWeekStart, weeklyMenus]);

  // Financial Stats from payment_status_admin view (hoặc tính live theo orders khi chưa khóa)
  const financialStats = useMemo(() => {
    let totalCollected = 0; // đã thu
    let totalPending = 0;   // còn thiếu
    let totalPaidCount = 0;
    let totalUnpaidCount = 0;
    let totalPendingCount = 0;

    effectivePaymentAdminList.forEach((row) => {
      const amount = Number(row.amount_due) || 0;
      if (row.status === 'paid') {
        totalCollected += amount;
        totalPaidCount++;
      } else if (row.status === 'pending') {
        totalPending += amount;
        totalPendingCount++;
      } else if (amount > 0) {
        totalPending += amount;
        totalUnpaidCount++;
      }
    });

    const totalRevenue = totalCollected + totalPending;
    return {
      totalCollected,
      totalPending,
      totalRevenue,
      totalPaidCount,
      totalUnpaidCount,
      totalPendingCount,
      totalEmployees: effectivePaymentAdminList.length,
    };
  }, [effectivePaymentAdminList]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return effectivePaymentAdminList.filter((row) => {
      const matchSearch =
        row.name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        (row.department && row.department.toLowerCase().includes(paymentSearch.toLowerCase())) ||
        (row.transfer_code && row.transfer_code.toLowerCase().includes(paymentSearch.toLowerCase()));

      let matchStatus = true;
      if (paymentStatusFilter === 'paid') {
        matchStatus = row.status === 'paid';
      } else if (paymentStatusFilter === 'pending') {
        matchStatus = row.status === 'pending';
      } else if (paymentStatusFilter === 'unpaid') {
        matchStatus = row.status === 'unpaid' || (row.status === null && (row.amount_due || 0) > 0);
      }

      return matchSearch && matchStatus;
    });
  }, [effectivePaymentAdminList, paymentSearch, paymentStatusFilter]);

  // Actions
  const handleCreateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuWeekStart) {
      showToast('Vui lòng chọn ngày bắt đầu tuần (Thứ 2).', 'error');
      return;
    }
    if (weeklyMenus.some((m) => m.week_start === newMenuWeekStart)) {
      showToast('Đã có thực đơn cho tuần này rồi, không thể tạo trùng.', 'error');
      return;
    }
    const created = await createWeeklyMenu(newMenuWeekStart);
    if (created) {
      setShowNewMenuModal(false);
      setNewMenuWeekStart('');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWeeklyMenu) return;
    if (!newItemName.trim()) {
      showToast('Vui lòng nhập tên món ăn', 'error');
      return;
    }
    const priceNum = parseInt(newItemPrice.replace(/\D/g, ''), 10) || 36000;
    const added = await addMenuItem({
      weekly_menu_id: currentWeeklyMenu.id,
      day_of_week: newItemDay,
      name: newItemName.trim(),
      price: priceNum,
    });
    if (added) {
      setNewItemName('');
      setNewItemPrice('36000');
      setShowAddItemModal(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (isMenuLocked) {
      showToast('Thực đơn đã khóa, không thể xóa món.', 'error');
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa món "${itemName}"?`)) {
      await deleteMenuItem(itemId);
    }
  };

  const handleLockMenu = async () => {
    if (!currentWeeklyMenu) return;
    if (
      window.confirm(
        `Bạn có chắc chắn muốn KHÓA thực đơn tuần ${currentWeeklyMenu.week_start}? Nhân viên sẽ không thể đặt thêm hoặc sửa món sau khi khóa.`
      )
    ) {
      await lockWeeklyMenu(currentWeeklyMenu.id);
    }
  };

  const handleGeneratePayments = async () => {
    if (!currentWeeklyMenu) return;
    if (
      window.confirm(
        'Hệ thống sẽ tổng hợp toàn bộ suất ăn trong tuần và tạo danh sách hóa đơn thu tiền cho từng nhân viên. Tiếp tục?'
      )
    ) {
      await generateWeeklyPayments(currentWeeklyMenu.id);
    }
  };

  const handleConfirmCash = async (row: PaymentStatusAdminRow) => {
    if (!row.payment_id) {
      showToast(
        'Chưa có mã hóa đơn. Hãy bấm "Chốt đơn & tạo hóa đơn tuần" trước khi thu tiền!',
        'error'
      );
      return;
    }
    if (
      window.confirm(
        `Xác nhận đã nhận đủ số tiền ${formatVND(row.amount_due || 0)} từ ${row.name}?`
      )
    ) {
      await confirmCashPayment(row.payment_id);
    }
  };

  const handleRejectPayment = async (row: PaymentStatusAdminRow) => {
    if (!row.payment_id) {
      showToast('Không tìm thấy mã hóa đơn để từ chối.', 'error');
      return;
    }
    if (
      window.confirm(
        `Từ chối xác nhận thanh toán của ${row.name}? Trạng thái sẽ được chuyển lại thành "Chưa thanh toán".`
      )
    ) {
      await rejectPaymentConfirmation(row.payment_id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-2 px-3 sm:px-4">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
              Quản Trị Hệ Thống (Admin)
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Quản lý thực đơn hàng tuần, chốt sổ và xác nhận thanh toán
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              onClick={() => setActiveTab('menu')}
              id="admin-tab-menu"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'menu'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Nhập menu đầu tuần
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              id="admin-tab-payments"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'payments'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Thanh Toán & Doanh Thu
            </button>
            <button
              onClick={() => {
                setActiveTab('feedbacks');
                markFeedbacksAsSeen();
              }}
              id="admin-tab-feedbacks"
              className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'feedbacks'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Ý kiến ({feedbacks.length})</span>
              {hasUnseenFeedback && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"
                  title="Có góp ý mới chưa xem"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              id="admin-tab-kitchen"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'kitchen'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Bếp</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: NHẬP MENU ĐẦU TUẦN */}
      {activeTab === 'menu' && (
        <div className="space-y-3">
          {/* Menu Control Bar */}
          <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-stone-500 font-medium">Thực đơn đang chọn:</span>
                <span className="text-sm font-black text-stone-900">
                  {currentWeeklyMenu?.week_start ? `Tuần ${currentWeeklyMenu.week_start}` : 'Chưa có'}
                </span>
                {isMenuLocked ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Đã khóa
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Đang mở đặt món
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowNewMenuModal(true)}
                id="btn-create-new-weekly-menu"
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition-colors"
              >
                + Tạo tuần mới
              </button>

              {!isMenuLocked && currentWeeklyMenu && (
                <button
                  onClick={handleLockMenu}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Khóa menu</span>
                </button>
              )}

              {/* Nút "Chốt đơn & tạo hóa đơn tuần": gọi RPC generate_payments */}
              {currentWeeklyMenu && (
                <button
                  onClick={handleGeneratePayments}
                  disabled={actionLoading}
                  id="btn-generate-payments-rpc"
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="Gọi RPC generate_payments để chốt sổ và tạo hóa đơn"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Chốt đơn & tạo hóa đơn tuần</span>
                </button>
              )}
            </div>
          </div>

          {/* Day of Week Navigation */}
          <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-xs">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-stone-700">Chọn ngày chỉnh sửa menu:</span>
              {!isMenuLocked && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExcelModal(true)}
                    id="btn-open-excel-import"
                    className="text-xs font-bold text-stone-700 hover:text-purple-700 bg-stone-100 hover:bg-purple-50 px-2.5 py-1.5 rounded-xl border border-stone-200 hover:border-purple-200 flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                    <span>Nhập từ Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openAddDishModal(selectedDay)}
                    id="btn-open-add-dish-modal"
                    className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm món vào {DAY_NAMES[selectedDay]}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {DAYS_OF_WEEK.map((dayDow) => {
                const isSelected = selectedDay === dayDow;
                const itemsCount = menuItems.filter(
                  (i) => i.weekly_menu_id === currentWeeklyMenu?.id && i.day_of_week === dayDow
                ).length;

                return (
                  <button
                    key={dayDow}
                    onClick={() => setSelectedDay(dayDow)}
                    className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                    }`}
                  >
                    <span className="text-xs font-black">{DAY_NAMES[dayDow]}</span>
                    <span
                      className={`text-[10px] font-medium mt-0.5 ${
                        isSelected ? 'text-purple-100' : 'text-stone-400'
                      }`}
                    >
                      {itemsCount} món
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Menu Items for Selected Day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Danh sách món ăn {DAY_NAMES[selectedDay]}
              </h3>
              <span className="text-xs text-stone-500 font-medium">
                {dayMenuItems.length} món đã nhập
              </span>
            </div>

            {dayMenuItems.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-8 text-center">
                <Utensils className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-stone-700">Chưa có món ăn nào trong ngày này</p>
                {!isMenuLocked && (
                  <button
                    type="button"
                    onClick={() => openAddDishModal(selectedDay)}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
                  >
                    + Thêm món đầu tiên
                  </button>
                )}
              </div>
            ) : (
              dayMenuItems.map((item) => {
                const isClosed = Boolean(item.is_closed);
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-3.5 border border-stone-200 shadow-xs flex items-center justify-between gap-3 ${
                      isClosed ? 'bg-stone-50/70 opacity-90' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border ${
                          isClosed
                            ? 'bg-stone-100 text-stone-400 border-stone-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {isClosed ? '🛑' : '🍛'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`font-bold text-sm leading-snug ${
                              isClosed ? 'text-stone-500 line-through' : 'text-stone-900'
                            }`}
                          >
                            {item.name}
                          </h4>
                          {isClosed && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shrink-0">
                              Đã đóng nhận đặt
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-purple-700 mt-0.5">
                          {formatVND(item.price)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle Đóng / Mở lại */}
                      <button
                        type="button"
                        onClick={() => toggleMenuItemClosed(item.id, !isClosed)}
                        disabled={actionLoading}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer disabled:opacity-50 ${
                          isClosed
                            ? 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border-emerald-300'
                            : 'bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 border-amber-300'
                        }`}
                        title={isClosed ? 'Mở lại cho nhân viên đặt món này' : 'Đóng nhận đặt món này'}
                      >
                        {isClosed ? 'Mở lại' : 'Đóng nhận đặt'}
                      </button>

                      {!isMenuLocked && (
                        <button
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          disabled={actionLoading}
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Xóa món ăn"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: THANH TOÁN & DOANH THU */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {/* Khối Tổng Hợp Doanh Thu Theo Tháng */}
          <div className="bg-linear-to-br from-amber-50 to-orange-50/70 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-amber-200/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
                    Tổng Hợp Doanh Thu Theo Tháng
                  </h3>
                  <p className="text-[11px] text-amber-800/80 font-medium">
                    Doanh thu tích lũy từ các tuần thực đơn đã thanh toán
                  </p>
                </div>
              </div>

              {/* Ô chọn tháng */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-amber-300 shadow-2xs self-start sm:self-auto">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <label htmlFor="admin-revenue-month" className="text-xs font-bold text-amber-900 shrink-0">
                  Chọn tháng:
                </label>
                <input
                  id="admin-revenue-month"
                  type="month"
                  value={selectedRevenueMonth}
                  onChange={(e) => setSelectedRevenueMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Hiển thị con số doanh thu */}
            <div className="pt-3.5">
              {effectiveHasWeeks ? (
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs sm:text-sm font-bold text-amber-950">
                      Doanh thu tháng {displayRevenueMonth}:
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-700 tracking-tight">
                      {formatVND(effectiveMonthlyRevenue)}
                    </span>
                    <span className="text-xs font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-lg">
                      (đã thanh toán)
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-amber-800/90">
                    Tổng hợp từ {weeksInSelectedMonth.length} tuần thực đơn trong tháng
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs sm:text-sm font-bold text-amber-950">
                      Doanh thu tháng {displayRevenueMonth}:
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-stone-400 tracking-tight">
                      0đ
                    </span>
                    <span className="text-xs font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2.5 py-0.5 rounded-lg">
                      Chưa có dữ liệu tháng này
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 italic">
                    Không có tuần thực đơn nào bắt đầu trong tháng {displayRevenueMonth}
                  </p>
                </div>
              )}
            </div>

            {/* Lịch sử thanh toán theo tuần trong tháng (Accordion + Search) */}
            {hasWeeksInMonth && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-amber-700" />
                      <span>Lịch Sử Thanh Toán Từng Tuần (Tháng {displayRevenueMonth})</span>
                    </h4>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                      {weeksInSelectedMonth.length} tuần
                    </span>
                  </div>

                  {/* Ô tìm kiếm nhân viên trong lịch sử */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      placeholder="Tìm theo tên hoặc mã nhân viên..."
                      className="w-full pl-8 pr-7 py-1.5 bg-white rounded-xl border border-amber-300 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                    />
                    {historySearchTerm && (
                      <button
                        onClick={() => setHistorySearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                        title="Xóa tìm kiếm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách các tuần dạng Accordion */}
                {(() => {
                  const term = historySearchTerm.trim().toLowerCase();

                  // Chuẩn bị dữ liệu từng tuần và lọc nếu có tìm kiếm
                  const processedWeeks = weeksInSelectedMonth.map((week) => {
                    const allPaidList = getPaidPaymentsForWeek(week.id);
                    const weekTotalPaid = allPaidList.reduce((sum, p) => sum + (p.amount_due || 0), 0);

                    const filteredPaidList = term
                      ? allPaidList.filter((p) => {
                          const nameMatch = (p.name || '').toLowerCase().includes(term);
                          const codeMatch = (p.transfer_code || '').toLowerCase().includes(term);
                          return nameMatch || codeMatch;
                        })
                      : allPaidList;

                    return {
                      week,
                      weekTitle: formatWeekTitle(week.week_start),
                      allPaidList,
                      filteredPaidList,
                      weekTotalPaid,
                      hasMatch: term ? filteredPaidList.length > 0 : true,
                    };
                  });

                  // Nếu đang tìm kiếm: ẩn các tuần không có ai khớp
                  const visibleWeeks = term
                    ? processedWeeks.filter((pw) => pw.hasMatch)
                    : processedWeeks;

                  if (term && visibleWeeks.length === 0) {
                    return (
                      <div className="py-6 text-center text-xs text-stone-500 bg-white/70 rounded-2xl border border-dashed border-amber-200">
                        Không tìm thấy nhân viên nào khớp với từ khóa "{historySearchTerm}" trong tháng {displayRevenueMonth}.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {visibleWeeks.map(({ week, weekTitle, allPaidList, filteredPaidList, weekTotalPaid }) => {
                        // Tự động mở rộng nếu đang tìm kiếm, nếu không thì theo expandedWeeks
                        const isExpanded = term ? true : Boolean(expandedWeeks[week.id]);

                        return (
                          <div
                            key={week.id}
                            className="bg-white/95 rounded-2xl border border-amber-200/90 shadow-2xs overflow-hidden transition-all"
                          >
                            {/* Dòng Header tóm tắt có thể bấm để mở/đóng */}
                            <button
                              type="button"
                              onClick={() => toggleWeekAccordion(week.id)}
                              className="w-full flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5 hover:bg-amber-50/50 transition-colors text-left cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="text-amber-700 shrink-0">
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-amber-700" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-amber-600" />
                                  )}
                                </div>
                                <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
                                <span className="font-black text-xs sm:text-sm text-stone-900 truncate">
                                  {weekTitle}
                                </span>
                                {week.locked_at && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                                    Đã chốt
                                  </span>
                                )}
                                {week.id === latestWeekInSelectedMonth && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                    Mới nhất
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
                                <div className="font-bold text-amber-900">
                                  Tổng đã thu:{' '}
                                  <span className="text-emerald-700 font-black">
                                    {formatVND(weekTotalPaid)}
                                  </span>
                                  <span className="text-[11px] text-stone-500 font-normal ml-1">
                                    ({allPaidList.length} người)
                                  </span>
                                </div>
                                <span className="text-[11px] text-amber-700 underline font-medium">
                                  {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                                </span>
                              </div>
                            </button>

                            {/* Bảng chi tiết mở rộng */}
                            {isExpanded && (
                              <div className="p-3 sm:p-4 pt-0 sm:pt-0 border-t border-amber-100/80">
                                {filteredPaidList.length === 0 ? (
                                  <div className="py-3 text-center text-xs text-stone-500 italic bg-amber-50/50 rounded-xl border border-dashed border-amber-200/80 mt-2.5">
                                    {term
                                      ? `Không có ai khớp với từ khóa "${historySearchTerm}"`
                                      : 'Chưa có ai thanh toán tuần này'}
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto mt-2.5">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-[11px] font-bold text-stone-500 border-b border-stone-100 bg-stone-50/70">
                                          <th className="py-2 px-2.5 rounded-l-lg">Họ và tên</th>
                                          <th className="py-2 px-2.5 text-center">Mã NV</th>
                                          <th className="py-2 px-2.5 text-right">Số tiền</th>
                                          <th className="py-2 px-2.5 text-center rounded-r-lg">Ngày xác nhận</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-stone-100">
                                        {filteredPaidList.map((payment) => (
                                          <tr key={payment.id} className="hover:bg-amber-50/40 transition-colors">
                                            <td className="py-2 px-2.5 font-bold text-stone-800">
                                              {payment.name}
                                            </td>
                                            <td className="py-2 px-2.5 text-center font-mono text-[11px] text-stone-600">
                                              {payment.transfer_code || '—'}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-black text-emerald-700">
                                              {formatVND(payment.amount_due)}
                                            </td>
                                            <td className="py-2 px-2.5 text-center text-stone-600 text-[11px] font-medium">
                                              {formatConfirmedAtDate(payment.confirmed_at)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Top Financial Stats: Đã thu / Còn thiếu */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
                <span>Tổng tiền đã thu</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {formatVND(financialStats.totalCollected)}
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                {financialStats.totalPaidCount} nhân viên đã thanh toán
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-4">
              <div className="flex items-center justify-between text-rose-800 text-xs font-semibold">
                <span>Tổng tiền còn thiếu</span>
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-rose-700 mt-1">
                {formatVND(financialStats.totalPending)}
              </p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                {financialStats.totalUnpaidCount} nhân viên chưa đóng tiền
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-3xl p-4">
              <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
                <span>Tổng doanh số tuần</span>
                <DollarSign className="w-4 h-4" />
              </div>
              <p className="text-2xl font-black text-stone-900 mt-1">
                {formatVND(financialStats.totalRevenue)}
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                {financialStats.totalEmployees} nhân viên nội bộ
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
              <button
                onClick={() => setPaymentStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  paymentStatusFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Tất cả ({effectivePaymentAdminList.length})
              </button>
              <button
                onClick={() => setPaymentStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  paymentStatusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                ⏳ Chờ xác nhận ({financialStats.totalPendingCount})
              </button>
              <button
                onClick={() => setPaymentStatusFilter('unpaid')}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  paymentStatusFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Chưa thanh toán ({financialStats.totalUnpaidCount})
              </button>
              <button
                onClick={() => setPaymentStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  paymentStatusFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Đã thanh toán ({financialStats.totalPaidCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc mã CK..."
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Table from view payment_status_admin */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                    <th className="py-3 px-3 sm:px-4">Nhân viên</th>
                    <th className="py-3 px-2 sm:px-3">Mã CK</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Số tiền</th>
                    <th className="py-3 px-2 sm:px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-3 sm:px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-400">
                        Không có dữ liệu thanh toán phù hợp
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((row) => {
                      const amount = Number(row.amount_due) || 0;
                      const isPaid = row.status === 'paid';
                      const isPending = row.status === 'pending';

                      return (
                        <tr key={row.user_id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-3 sm:px-4">
                            <p className="font-bold text-stone-900">{row.name}</p>
                            <p className="text-[11px] text-stone-500">{row.department || 'Nhân sự'}</p>
                          </td>

                          <td className="py-3 px-2 sm:px-3">
                            <span className="font-mono text-[11px] font-bold bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded border border-stone-200">
                              {row.transfer_code || 'NV'}
                            </span>
                          </td>

                          <td className="py-3 px-3 sm:px-4 text-right">
                            <span className="font-black text-sm text-stone-900">
                              {formatVND(amount)}
                            </span>
                          </td>

                          <td className="py-3 px-2 sm:px-3 text-center">
                            {isPaid ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Đã thanh toán
                                </span>
                                {row.confirmed_at && (
                                  <span className="text-[10px] text-stone-500 font-medium mt-0.5">
                                    {formatConfirmedAtDate(row.confirmed_at)}
                                  </span>
                                )}
                              </div>
                            ) : isPending ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                <Clock className="w-3 h-3" />
                                ⏳ Chờ xác nhận
                              </span>
                            ) : amount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertCircle className="w-3 h-3" />
                                Chưa trả
                              </span>
                            ) : (
                              <span className="text-[11px] text-stone-400">Không đặt</span>
                            )}
                          </td>

                          <td className="py-3 px-3 sm:px-4 text-center">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleConfirmCash(row)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-xs flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                                  title="Xác nhận thanh toán (chuyển thành Đã thanh toán)"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Xác nhận</span>
                                </button>
                                <button
                                  onClick={() => handleRejectPayment(row)}
                                  disabled={actionLoading}
                                  className="px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                                  title="Từ chối xác nhận (chuyển về Chưa thanh toán)"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Từ chối</span>
                                </button>
                              </div>
                            ) : isPaid ? (
                              <span className="text-[11px] text-stone-500 font-medium">
                                Đã xác nhận{row.confirmed_by ? ` (${row.confirmed_by})` : ''}
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FEEDBACK */}
      {activeTab === 'feedbacks' && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs">
            <h3 className="font-bold text-sm text-stone-900 mb-1">Đánh giá & Góp ý từ nhân viên</h3>
            <p className="text-xs text-stone-500">
              Tổng hợp nhận xét chất lượng bữa ăn để trao đổi và cải thiện cùng bếp ăn
            </p>
          </div>

          <div className="space-y-2.5">
            {feedbacks.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-8 text-center">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-700">Chưa có góp ý nào từ nhân viên</p>
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= fb.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-stone-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-xs text-stone-800">
                        {fb.rating}/5 sao
                      </span>
                    </div>

                    <span className="text-[11px] text-stone-400">
                      {fb.created_at ? new Date(fb.created_at).toLocaleDateString('vi-VN') : 'Gần đây'}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-stone-800 italic">
                    "{fb.comment}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BẾP (KITCHEN SUMMARY) */}
      {activeTab === 'kitchen' && (
        <KitchenView isEmbedded={true} />
      )}

      {/* MODAL: TẠO THỰC ĐƠN TUẦN MỚI */}
      {showNewMenuModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">Tạo thực đơn tuần mới</h3>
              <button
                onClick={() => setShowNewMenuModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMenu} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Ngày bắt đầu tuần (Thứ 2)
                </label>
                <input
                  type="date"
                  value={newMenuWeekStart}
                  onChange={(e) => setNewMenuWeekStart(e.target.value)}
                  className={`w-full px-3 py-2 bg-stone-50 border rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 ${
                    isWeekAlreadyExists
                      ? 'border-amber-400 focus:ring-amber-500/20 focus:border-amber-500 bg-amber-50/40'
                      : 'border-stone-200 focus:ring-purple-500/20 focus:border-purple-500'
                  }`}
                  required
                />
              </div>

              {isWeekAlreadyExists && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800">
                      Đã có thực đơn cho tuần này rồi, không thể tạo trùng.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Ngày {newMenuWeekStart} đã tồn tại trong danh sách thực đơn. Vui lòng chọn tuần khác.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewMenuModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || isWeekAlreadyExists || !newMenuWeekStart}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Đang tạo...' : 'Tạo tuần mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM MÓN ĂN VÀO NGÀY */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base text-stone-900">
                Thêm món vào {DAY_NAMES[newItemDay]}
              </h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Ngày trong tuần
                </label>
                <select
                  value={newItemDay}
                  onChange={(e) => setNewItemDay(e.target.value as DayOfWeek)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {DAY_NAMES[d]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tên món ăn
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Ví dụ: Cơm sườn nướng mật ong"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Giá tiền (VNĐ)
                </label>
                <input
                  type="number"
                  value={newItemPrice}
                  step={1000}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="36000"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Đang lưu...' : 'Thêm món'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelModal && currentWeeklyMenu && (
        <ExcelImportModal
          isOpen={showExcelModal}
          onClose={() => setShowExcelModal(false)}
          weeklyMenuId={currentWeeklyMenu.id}
          addMenuItem={addMenuItem}
          showToast={showToast}
        />
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DayOfWeek, MenuItem, PaymentStatusAdminRow, DAYS_OF_WEEK } from '../types/database';
import { formatVND, DAY_NAMES } from '../utils/formatters';
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
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    weeklyMenus,
    currentWeeklyMenu,
    menuItems,
    paymentAdminList,
    feedbacks,
    actionLoading,
    createWeeklyMenu,
    lockWeeklyMenu,
    addMenuItem,
    deleteMenuItem,
    generateWeeklyPayments,
    confirmCashPayment,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'menu' | 'payments' | 'feedbacks'>('menu');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');

  // New Menu Form
  const [showNewMenuModal, setShowNewMenuModal] = useState(false);
  const [newMenuWeekStart, setNewMenuWeekStart] = useState('');

  // Add Item Form
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('40000');
  const [newItemDay, setNewItemDay] = useState<DayOfWeek>('monday');

  // Payment Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [paymentSearch, setPaymentSearch] = useState('');

  const isMenuLocked = Boolean(currentWeeklyMenu?.locked_at);

  // Filtered menu items for the current day in Admin tab
  const dayMenuItems = useMemo(() => {
    if (!currentWeeklyMenu) return [];
    return menuItems.filter(
      (item) => item.weekly_menu_id === currentWeeklyMenu.id && item.day_of_week === selectedDay
    );
  }, [menuItems, currentWeeklyMenu, selectedDay]);

  // Financial Stats from payment_status_admin view
  const financialStats = useMemo(() => {
    let totalCollected = 0; // đã thu
    let totalPending = 0;   // còn thiếu
    let totalPaidCount = 0;
    let totalUnpaidCount = 0;

    paymentAdminList.forEach((row) => {
      const amount = Number(row.amount_due) || 0;
      if (row.status === 'paid') {
        totalCollected += amount;
        totalPaidCount++;
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
      totalEmployees: paymentAdminList.length,
    };
  }, [paymentAdminList]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return paymentAdminList.filter((row) => {
      const matchSearch =
        row.name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        (row.department && row.department.toLowerCase().includes(paymentSearch.toLowerCase())) ||
        (row.transfer_code && row.transfer_code.toLowerCase().includes(paymentSearch.toLowerCase()));

      let matchStatus = true;
      if (paymentStatusFilter === 'paid') {
        matchStatus = row.status === 'paid';
      } else if (paymentStatusFilter === 'unpaid') {
        matchStatus = row.status === 'unpaid' || (row.status === null && (row.amount_due || 0) > 0);
      }

      return matchSearch && matchStatus;
    });
  }, [paymentAdminList, paymentSearch, paymentStatusFilter]);

  // Actions
  const handleCreateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuWeekStart) {
      showToast('Vui lòng chọn ngày bắt đầu tuần (Thứ 2).', 'error');
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
    const priceNum = parseInt(newItemPrice.replace(/\D/g, ''), 10) || 35000;
    const added = await addMenuItem({
      weekly_menu_id: currentWeeklyMenu.id,
      day_of_week: newItemDay,
      name: newItemName.trim(),
      price: priceNum,
    });
    if (added) {
      setNewItemName('');
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
              Thanh toán
            </button>
            <button
              onClick={() => setActiveTab('feedbacks')}
              id="admin-tab-feedbacks"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'feedbacks'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Ý kiến ({feedbacks.length})
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
                <button
                  onClick={() => {
                    setNewItemDay(selectedDay);
                    setShowAddItemModal(true);
                  }}
                  id="btn-open-add-dish-modal"
                  className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm món vào {DAY_NAMES[selectedDay]}</span>
                </button>
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
                    onClick={() => {
                      setNewItemDay(selectedDay);
                      setShowAddItemModal(true);
                    }}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
                  >
                    + Thêm món đầu tiên
                  </button>
                )}
              </div>
            ) : (
              dayMenuItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-base shrink-0">
                      🍛
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-stone-900">{item.name}</h4>
                      <p className="text-xs font-black text-purple-700 mt-0.5">
                        {formatVND(item.price)}
                      </p>
                    </div>
                  </div>

                  {!isMenuLocked && (
                    <button
                      onClick={() => handleDeleteItem(item.id, item.name)}
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Xóa món ăn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: THANH TOÁN */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
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
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap ${
                  paymentStatusFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Tất cả ({paymentAdminList.length})
              </button>
              <button
                onClick={() => setPaymentStatusFilter('unpaid')}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap ${
                  paymentStatusFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Chưa thanh toán ({financialStats.totalUnpaidCount})
              </button>
              <button
                onClick={() => setPaymentStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap ${
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
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Đã thanh toán
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
                            {!isPaid && amount > 0 ? (
                              <button
                                onClick={() => handleConfirmCash(row)}
                                disabled={actionLoading}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-xs flex items-center justify-center gap-1 mx-auto disabled:opacity-50"
                                title="Gọi RPC confirm_payment xác nhận đã nhận tiền mặt"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Xác nhận đã nhận tiền</span>
                              </button>
                            ) : isPaid ? (
                              <span className="text-[11px] text-stone-500 font-medium">
                                Đã xác nhận ({row.confirmed_by || 'Admin'})
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
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  required
                />
              </div>

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
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Đang tạo...' : 'Tạo tuần'}
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
                  placeholder="40000"
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
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DayOfWeek, MenuItem } from '../types/database';
import { getDatesForCurrentWeek } from '../lib/supabase';
import { formatVND, DAY_NAMES } from '../utils/formatters';
import {
  Calendar,
  CheckCircle2,
  Plus,
  Minus,
  MessageSquare,
  QrCode,
  AlertCircle,
  Receipt,
  Star,
  Send,
  Lock,
  Utensils,
  Copy,
  Clock,
} from 'lucide-react';

export const EmployeeView: React.FC = () => {
  const {
    currentUser,
    activeRole,
    currentWeeklyMenu,
    menuItems,
    orders,
    payments,
    upsertOrder,
    submitFeedback,
    requestPaymentConfirmation,
    actionLoading,
    showToast,
    getDeadlineForDay,
    appSettings,
  } = useApp();

  const isAdmin = currentUser?.role === 'admin' || activeRole === 'admin';

  // Periodic tick to re-evaluate deadline countdown in real-time
  const [, setTick] = useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const weekDates = useMemo(() => {
    return getDatesForCurrentWeek(currentWeeklyMenu?.week_start);
  }, [currentWeeklyMenu?.week_start]);

  // Determine current day of week (monday-friday)
  const todayDow = useMemo((): DayOfWeek => {
    const d = new Date().getDay();
    const map: Record<number, DayOfWeek> = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
    };
    return map[d] || 'monday';
  }, []);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDow);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Deadline calculation for selected day
  const selectedDayDeadline = getDeadlineForDay(selectedDay);
  const cutoffTimeDisplay =
    selectedDayDeadline.formattedCutoff ||
    (appSettings?.order_cutoff ? appSettings.order_cutoff.slice(0, 5) : '10:30');
  const isSelectedDayPassed = selectedDayDeadline.isPassed;
  const isSelectedDayDisabled = isSelectedDayPassed && !isAdmin;

  // Feedback state
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState('');
  const [fbMenuItemId, setFbMenuItemId] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  const isMenuLocked = Boolean(currentWeeklyMenu?.locked_at);

  // Filter menu items for selected day
  const dayMenuItems = useMemo(() => {
    if (!currentWeeklyMenu) return [];
    return menuItems.filter(
      (item) => item.weekly_menu_id === currentWeeklyMenu.id && item.day_of_week === selectedDay
    );
  }, [menuItems, currentWeeklyMenu, selectedDay]);

  // Map user quantities for current menu items: { [menu_item_id]: quantity }
  const userOrderQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    if (!currentUser) return map;
    orders
      .filter((o) => o.user_id === currentUser.id)
      .forEach((o) => {
        map[o.menu_item_id] = o.quantity;
      });
    return map;
  }, [orders, currentUser]);

  // Calculate week summary for current user
  const userWeekStats = useMemo(() => {
    if (!currentWeeklyMenu || !currentUser) {
      return { totalDishes: 0, totalAmount: 0, orderedItems: [] as { item: MenuItem; quantity: number }[] };
    }

    const currentMenuItemsMap = new Map<string, MenuItem>(
      menuItems.filter((i) => i.weekly_menu_id === currentWeeklyMenu.id).map((i) => [i.id, i])
    );

    let totalDishes = 0;
    let totalAmount = 0;
    const orderedItems: { item: MenuItem; quantity: number }[] = [];

    orders
      .filter((o) => o.user_id === currentUser.id)
      .forEach((o) => {
        const item = currentMenuItemsMap.get(o.menu_item_id);
        if (item && o.quantity > 0) {
          totalDishes += o.quantity;
          totalAmount += item.price * o.quantity;
          orderedItems.push({ item, quantity: o.quantity });
        }
      });

    return { totalDishes, totalAmount, orderedItems };
  }, [currentWeeklyMenu, currentUser, menuItems, orders]);

  // Read payment record from payments table
  const userPayment = useMemo(() => {
    if (!currentUser || !currentWeeklyMenu) return null;
    return (
      payments.find(
        (p) => p.user_id === currentUser.id && p.weekly_menu_id === currentWeeklyMenu.id
      ) || null
    );
  }, [payments, currentUser, currentWeeklyMenu]);

  // Logic hiển thị số tiền và số suất ăn đồng bộ:
  // - Nếu currentWeeklyMenu.locked_at là null (chưa khóa menu): LUÔN hiển thị userWeekStats.totalAmount
  //   (tổng đơn hàng hiện tại), không dùng userPayment.amount_due dù nó có tồn tại.
  // - Nếu currentWeeklyMenu.locked_at có giá trị (đã khóa menu): hiển thị userPayment.amount_due (số đã chốt cố định).
  // Cả 2 dòng "Số tiền cần thanh toán" và "Tổng X suất ăn trong tuần" lấy cùng nguồn nhất quán.
  const displayPaymentInfo = useMemo(() => {
    const isLocked = Boolean(currentWeeklyMenu?.locked_at);
    if (!isLocked) {
      return {
        amount: userWeekStats.totalAmount,
        dishes: userWeekStats.totalDishes,
      };
    }

    // Khi đã khóa menu:
    if (userPayment) {
      const dishes =
        userWeekStats.totalAmount > 0 && userWeekStats.totalAmount === userPayment.amount_due
          ? userWeekStats.totalDishes
          : Math.max(1, Math.round((userPayment.amount_due || 0) / 36000));
      return {
        amount: userPayment.amount_due || 0,
        dishes,
      };
    }

    return {
      amount: userWeekStats.totalAmount,
      dishes: userWeekStats.totalDishes,
    };
  }, [currentWeeklyMenu?.locked_at, userPayment, userWeekStats]);

  const paymentStatus = userPayment?.status || 'unpaid';
  const isPaid = paymentStatus === 'paid';
  const isPending = paymentStatus === 'pending';
  const isUnpaid = paymentStatus === 'unpaid';

  // Kiểm tra nếu nhân viên đã đặt món ít nhất 1 ngày trước ngày hiện tại trong tuần đó
  const hasOrderedPastDayInWeek = useMemo(() => {
    const now = new Date();
    const rawDay = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const currentDowNum = rawDay === 0 ? 7 : rawDay;

    const dayIndexMap: Record<DayOfWeek, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
    };

    return userWeekStats.orderedItems.some(
      ({ item, quantity }) => quantity > 0 && dayIndexMap[item.day_of_week] < currentDowNum
    );
  }, [userWeekStats.orderedItems]);

  const handleMarkTransferred = async () => {
    if (!currentWeeklyMenu) return;
    if (displayPaymentInfo.amount <= 0 && userWeekStats.totalAmount <= 0) {
      showToast('Bạn chưa có đơn đặt món nào trong tuần này.', 'info');
      return;
    }
    await requestPaymentConfirmation(currentWeeklyMenu.id, userWeekStats.totalAmount);
  };

  // Cú pháp chuyển khoản linh hoạt theo ngày đặt thực tế của nhân viên
  const transferSyntax = useMemo(() => {
    const userIdentifier = currentUser?.transfer_code || currentUser?.name || 'NV';

    // Nếu chưa có menu tuần hoặc chưa đặt món nào trong tuần này
    if (!currentWeeklyMenu || userWeekStats.orderedItems.length === 0) {
      return `COM_${userIdentifier}`;
    }

    // Xác định ngày Thứ 2 của tuần (week_start)
    let mondayDate: Date;
    if (currentWeeklyMenu.week_start) {
      const dateOnly = currentWeeklyMenu.week_start.split('T')[0];
      const parts = dateOnly.split('-');
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        mondayDate = !isNaN(year) && !isNaN(month) && !isNaN(day)
          ? new Date(year, month - 1, day)
          : new Date();
      } else {
        mondayDate = new Date();
      }
    } else {
      mondayDate = new Date();
    }

    const dayOffsetMap: Record<DayOfWeek, number> = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
    };

    // Với mỗi món có quantity > 0, tính ngày thực tế
    const orderDates: Date[] = [];
    userWeekStats.orderedItems.forEach(({ item, quantity }) => {
      if (quantity > 0) {
        const offset = dayOffsetMap[item.day_of_week] ?? 0;
        const d = new Date(
          mondayDate.getFullYear(),
          mondayDate.getMonth(),
          mondayDate.getDate() + offset
        );
        orderDates.push(d);
      }
    });

    if (orderDates.length === 0) {
      return `COM_${userIdentifier}`;
    }

    // Tìm ngày sớm nhất (minDate) và muộn nhất (maxDate)
    orderDates.sort((a, b) => a.getTime() - b.getTime());
    const minDate = orderDates[0];
    const maxDate = orderDates[orderDates.length - 1];

    const formatDDMMYYYY = (date: Date): string => {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}${m}${y}`;
    };

    const minStr = formatDDMMYYYY(minDate);
    const maxStr = formatDDMMYYYY(maxDate);

    // Nếu đặt đúng 1 ngày duy nhất trong tuần -> COM_[DDMMYYYY]_[mã cá nhân]
    // Nếu đặt nhiều ngày khác nhau -> COM_[minDate]-[maxDate]_[mã cá nhân]
    if (minStr === maxStr) {
      return `COM_${minStr}_${userIdentifier}`;
    } else {
      return `COM_${minStr}-${maxStr}_${userIdentifier}`;
    }
  }, [currentUser, currentWeeklyMenu, userWeekStats.orderedItems]);

  const handleCopySyntax = () => {
    navigator.clipboard.writeText(transferSyntax);
    setCopiedCode(true);
    showToast(`Đã sao chép cú pháp: ${transferSyntax}`, 'info');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleQuantityChange = async (item: MenuItem, change: number) => {
    if (isMenuLocked) {
      showToast('Thực đơn tuần này đã được chốt, không thể thay đổi suất ăn.', 'error');
      return;
    }
    const itemDeadline = getDeadlineForDay(item.day_of_week);
    if (itemDeadline.isPassed && !isAdmin) {
      showToast(`Đã quá giờ chốt đặt món (quá ${cutoffTimeDisplay}).`, 'error');
      return;
    }
    if (change > 0 && item.is_closed) {
      showToast('Món này đã hết (bếp đã đóng nhận đặt thêm).', 'error');
      return;
    }
    const currentQty = userOrderQuantities[item.id] || 0;
    const newQty = Math.max(0, currentQty + change);
    await upsertOrder(item.id, newQty);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbComment.trim()) {
      showToast('Vui lòng nhập nhận xét của bạn.', 'error');
      return;
    }
    const targetItemId = fbMenuItemId || dayMenuItems[0]?.id || menuItems[0]?.id;
    const success = await submitFeedback(targetItemId, fbRating, fbComment.trim());
    if (success) {
      setFbComment('');
      setFbRating(5);
      setFbMenuItemId('');
      setShowFeedbackModal(false);
    }
  };

  if (!currentWeeklyMenu) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center py-16">
        <Utensils className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-stone-800">Chưa có thực đơn tuần này</h2>
        <p className="text-xs text-stone-500 mt-1">Admin đang chuẩn bị menu. Vui lòng quay lại sau.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-32 pt-2 px-3 sm:px-4">
      {/* Top Banner if Locked */}
      {isMenuLocked && (
        <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Thực đơn tuần này đã khóa chốt sổ. Bạn chỉ có thể xem lại các suất đã đặt.</span>
        </div>
      )}

      {/* Week Header & Day Tabs */}
      <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-xs mb-3">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
            <Calendar className="w-4 h-4 text-orange-600" />
            <span>Thực đơn tuần {currentWeeklyMenu.week_start}</span>
          </div>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="text-[11px] font-semibold text-orange-700 hover:text-orange-800 flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-xl transition-colors border border-orange-200"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Góp ý bữa ăn</span>
          </button>
        </div>

        {/* 5 Day Tabs: T2 -> T6 */}
        <div className="grid grid-cols-5 gap-1.5">
          {weekDates.map((wd) => {
            const isSelected = selectedDay === wd.day;
            const isToday = todayDow === wd.day;
            const dayDeadline = getDeadlineForDay(wd.day);

            // Count dishes ordered on this day
            const dayItems = menuItems.filter(
              (i) => i.weekly_menu_id === currentWeeklyMenu.id && i.day_of_week === wd.day
            );
            const orderedCountOnDay = dayItems.reduce(
              (acc, it) => acc + (userOrderQuantities[it.id] || 0),
              0
            );

            return (
              <button
                key={wd.day}
                id={`day-tab-${wd.day}`}
                onClick={() => setSelectedDay(wd.day)}
                className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all relative ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-xs ring-2 ring-orange-600/30'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                }`}
              >
                {orderedCountOnDay > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs ${
                      isPaid
                        ? 'bg-emerald-600 text-white'
                        : isSelected
                        ? 'bg-amber-400 text-stone-950 font-black'
                        : 'bg-orange-600 text-white'
                    }`}
                  >
                    {orderedCountOnDay}
                  </span>
                )}
                <span className="text-xs font-black leading-tight">{wd.label}</span>
                <span
                  className={`text-[10px] font-medium leading-none mt-0.5 ${
                    isSelected ? 'text-orange-100' : 'text-stone-400'
                  }`}
                >
                  {wd.shortDate}
                </span>
                {dayDeadline.isPassed ? (
                  <span
                    className={`text-[9px] font-bold mt-1 px-1 rounded-full ${
                      isSelected ? 'bg-black/25 text-white' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    Đã chốt
                  </span>
                ) : isToday ? (
                  <span
                    className={`text-[9px] font-bold mt-1 px-1 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    Hôm nay
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu items of the selected day */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>Món ăn {DAY_NAMES[selectedDay]}</span>
            <span className="text-[11px] font-medium text-stone-500">
              ({dayMenuItems.length} món)
            </span>
          </h3>
          <span
            className={`text-[11px] font-medium ${
              isSelectedDayDisabled ? 'text-rose-600 font-semibold' : 'text-stone-500'
            }`}
          >
            {isSelectedDayDisabled ? 'Đã hết giờ đặt món' : 'Bấm +/- để chọn số lượng'}
          </span>
        </div>

        {/* Deadline Status Badge */}
        {selectedDayDeadline.isPassed ? (
          <div
            id="badge-deadline-passed"
            className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs font-bold">
                Đã chốt đặt món (quá {cutoffTimeDisplay})
              </span>
            </div>
            {isAdmin ? (
              <span className="text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded-md border border-rose-200 shadow-2xs">
                Admin mở khóa
              </span>
            ) : (
              <span className="text-[11px] font-medium text-rose-600">
                Chỉ xem đơn
              </span>
            )}
          </div>
        ) : selectedDayDeadline.isToday ? (
          <div
            id="badge-deadline-today"
            className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
              <span className="text-xs font-bold">
                Còn {selectedDayDeadline.remainingHours} giờ {selectedDayDeadline.remainingMinutes} phút đến hạn chốt
              </span>
            </div>
            <span className="text-[11px] font-medium text-amber-700">
              (Chốt {cutoffTimeDisplay})
            </span>
          </div>
        ) : null}

        {dayMenuItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-stone-200 p-8 text-center">
            <Utensils className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-700">Chưa có món ăn cho ngày này</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Admin đang cập nhật thêm thực đơn.</p>
          </div>
        ) : (
          dayMenuItems.map((item) => {
            const quantity = userOrderQuantities[item.id] || 0;
            const isSelected = quantity > 0;
            const isClosed = Boolean(item.is_closed);

            return (
              <div
                key={item.id}
                id={`menu-item-card-${item.id}`}
                className={`bg-white rounded-3xl p-3.5 border transition-all flex items-center justify-between gap-3 shadow-xs ${
                  isSelected
                    ? 'border-orange-500/80 bg-orange-50/20 ring-1 ring-orange-500/20'
                    : 'border-stone-200 hover:border-stone-300'
                } ${isClosed ? 'opacity-90' : ''}`}
              >
                {/* Dish Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4
                      className={`font-bold text-sm leading-snug ${
                        isClosed ? 'text-stone-600' : 'text-stone-900'
                      }`}
                    >
                      {item.name}
                    </h4>
                    {isClosed && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shrink-0">
                        Đã hết món
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`font-black text-sm ${
                        isClosed ? 'text-stone-400' : 'text-orange-600'
                      }`}
                    >
                      {formatVND(item.price)}
                    </span>
                    {isSelected && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Đã chọn {quantity} suất
                      </span>
                    )}
                  </div>
                </div>

                {/* Big Touch-Friendly Quantity Stepper */}
                <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item, -1)}
                    disabled={quantity === 0 || isMenuLocked || isSelectedDayDisabled}
                    aria-label={`Giảm số lượng ${item.name}`}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      quantity > 0 && !isMenuLocked && !isSelectedDayDisabled
                        ? 'bg-white text-stone-800 hover:bg-stone-50 active:scale-95 shadow-xs cursor-pointer'
                        : 'text-stone-300 bg-stone-100 cursor-not-allowed'
                    }`}
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <span className="w-7 text-center font-black text-base text-stone-900">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item, 1)}
                    disabled={isMenuLocked || isClosed || isSelectedDayDisabled}
                    aria-label={`Tăng số lượng ${item.name}`}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      !isMenuLocked && !isClosed && !isSelectedDayDisabled
                        ? 'bg-orange-600 text-white hover:bg-orange-700 active:scale-95 shadow-xs cursor-pointer'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FIXED BOTTOM SUMMARY BAR - Mobile First */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg px-3 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {/* Summary Details */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 font-medium">Tổng tuần này:</span>
              <span className="text-xs font-bold text-stone-700">
                {displayPaymentInfo.dishes} suất
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-black text-stone-900">
                {formatVND(displayPaymentInfo.amount)}
              </span>

              {/* Status Badge */}
              {isPaid ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã thanh toán
                </span>
              ) : isPending ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock className="w-3 h-3" />
                  ⏳ Đang chờ xác nhận
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  <AlertCircle className="w-3 h-3" />
                  Chưa thanh toán
                </span>
              )}
            </div>
          </div>

          {/* Action: Transfer / QR Code Button */}
          <button
            onClick={() => setShowQrModal(true)}
            id="btn-view-payment-qr"
            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 active:bg-black text-white px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-colors shadow-xs shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>Thanh toán QR</span>
          </button>
        </div>
      </div>

      {/* MODAL THANH TOÁN & MÃ VIETQR */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-base text-stone-900">Chi tiết thanh toán tuần</h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Payment status row */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-600 font-medium">Trạng thái:</span>
                {isPaid ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                    Đã thanh toán ({userPayment?.method === 'transfer' ? 'Chuyển khoản' : (userPayment?.method || 'Tiền mặt')})
                  </span>
                ) : isPending ? (
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                    ⏳ Đang chờ xác nhận
                  </span>
                ) : (
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-300">
                    Chưa thanh toán
                  </span>
                )}
              </div>

              {/* Nhắc nhở nếu chưa thanh toán và đã đặt món ít nhất 1 ngày trước ngày hiện tại trong tuần */}
              {isUnpaid && hasOrderedPastDayInWeek && (
                <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                  <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                    💡 Bạn đã đặt món từ đầu tuần. Hãy thanh toán sớm, đừng để dồn đến cuối tuần nhé!
                  </p>
                </div>
              )}

              {/* Total amount due */}
              <div className="text-center py-2 bg-orange-50 rounded-2xl border border-orange-200">
                <p className="text-xs text-orange-800 font-semibold">Số tiền cần thanh toán</p>
                <p className="text-2xl font-black text-orange-600 mt-0.5">
                  {formatVND(displayPaymentInfo.amount)}
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Tổng {displayPaymentInfo.dishes} suất ăn trong tuần
                </p>
              </div>

              {/* Transfer Syntax Box with Copy */}
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-500 font-medium">Cú pháp chuyển khoản:</span>
                  <button
                    onClick={handleCopySyntax}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedCode ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
                <div className="font-mono text-sm font-bold text-stone-900 bg-white p-2 rounded-xl border border-stone-300 text-center tracking-wider select-all">
                  {transferSyntax}
                </div>
                {currentUser?.transfer_code && (
                  <p className="text-[10px] text-stone-500 text-center">
                    Mã định danh cá nhân: <strong>{currentUser.transfer_code}</strong>
                  </p>
                )}
              </div>

              {/* VietQR Quick Image */}
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 flex flex-col items-center text-center">
                <div className="w-36 h-36 bg-white p-2 rounded-xl shadow-xs border border-stone-200 flex items-center justify-center">
                  <img
                    src={`https://api.vietqr.io/image/970422-0852320758-compact.jpg?amount=${
                      displayPaymentInfo.amount
                    }&addInfo=${encodeURIComponent(transferSyntax)}&accountName=${encodeURIComponent('TRUONG XUAN TUONG')}`}
                    alt="VietQR Chuyển khoản cơm trưa"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-2">
                  Quét mã trên app ngân hàng hoặc nộp trực tiếp tiền mặt cho Admin.
                </p>
              </div>

              {/* Nút "Tôi đã chuyển khoản" */}
              {!isPaid && (
                <button
                  onClick={handleMarkTransferred}
                  disabled={isPending || actionLoading || (displayPaymentInfo.amount <= 0 && userWeekStats.totalAmount <= 0)}
                  id="btn-confirm-transferred"
                  className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    isPending
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-90'
                      : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white shadow-xs cursor-pointer'
                  }`}
                >
                  {isPending ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span>⏳ Đang chờ xác nhận</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tôi đã chuyển khoản</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GỬI FEEDBACK & ĐÁNH GIÁ BỮA ĂN */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-base text-stone-900">Góp ý & Đánh giá bữa ăn</h3>
              </div>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitFeedback} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Món ăn bạn muốn góp ý
                </label>
                <select
                  value={fbMenuItemId}
                  onChange={(e) => setFbMenuItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="">-- Chọn món ăn để đánh giá --</option>
                  {userWeekStats.orderedItems.map(({ item }) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatVND(item.price)})
                    </option>
                  ))}
                  {menuItems
                    .filter((i) => i.weekly_menu_id === currentWeeklyMenu.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Star Rating */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 text-center">
                  Mức độ hài lòng của bạn
                </label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFbRating(star)}
                      className="p-1.5 transition-transform hover:scale-110 active:scale-95"
                      aria-label={`${star} sao`}
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= fbRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-stone-300 stroke-1'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-center text-[11px] font-semibold text-stone-500 mt-1">
                  {fbRating === 5 && '🌟 Rất ngon, phục vụ tuyệt vời!'}
                  {fbRating === 4 && '👍 Ngon miệng, vừa khẩu vị.'}
                  {fbRating === 3 && '👌 Tạm được, cần cải thiện thêm.'}
                  {fbRating === 2 && '👎 Chưa hài lòng với món này.'}
                  {fbRating === 1 && '⚠️ Không đạt yêu cầu.'}
                </p>
              </div>

              {/* Comment text */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nhận xét & Góp ý chi tiết
                </label>
                <textarea
                  rows={3}
                  value={fbComment}
                  onChange={(e) => setFbComment(e.target.value)}
                  placeholder="Chia sẻ về độ mặn ngọt, độ nóng, cơm canh hoặc yêu cầu khác..."
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 placeholder:text-stone-400"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Đang gửi...' : 'Gửi góp ý'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

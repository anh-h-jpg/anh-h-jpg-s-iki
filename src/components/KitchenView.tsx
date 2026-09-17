import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DayOfWeek, KitchenSummaryRow, DAYS_OF_WEEK } from '../types/database';
import { DAY_NAMES } from '../utils/formatters';
import {
  ChefHat,
  Zap,
  Clock,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react';

export const KitchenView: React.FC = () => {
  const {
    currentWeeklyMenu,
    kitchenSummary,
    lastKitchenUpdate,
    refreshKitchenSummary,
    isSupabaseLive,
  } = useApp();

  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | DayOfWeek>('all');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format time HH:MM:SS
  const lastUpdateTimeStr = useMemo(() => {
    if (!lastKitchenUpdate) return '--:--:--';
    const h = String(lastKitchenUpdate.getHours()).padStart(2, '0');
    const m = String(lastKitchenUpdate.getMinutes()).padStart(2, '0');
    const s = String(lastKitchenUpdate.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [lastKitchenUpdate]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshKitchenSummary();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter rows from view kitchen_summary
  const filteredRows = useMemo(() => {
    return kitchenSummary.filter((row) => {
      const matchDay = selectedDayFilter === 'all' || row.day_of_week === selectedDayFilter;
      const matchSearch =
        !search.trim() || row.item_name.toLowerCase().includes(search.toLowerCase());
      return matchDay && matchSearch;
    });
  }, [kitchenSummary, selectedDayFilter, search]);

  // Group by string day of week ('monday' -> 'friday')
  const groupedByDay = useMemo(() => {
    const map = new Map<DayOfWeek, KitchenSummaryRow[]>();
    DAYS_OF_WEEK.forEach((d) => map.set(d, []));

    filteredRows.forEach((row) => {
      const d = row.day_of_week;
      if (map.has(d)) {
        map.get(d)!.push(row);
      } else {
        map.set(d, [row]);
      }
    });

    return map;
  }, [filteredRows]);

  // Summary Metrics
  const totalMeals = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (Number(r.total_quantity) || 0), 0);
  }, [filteredRows]);

  const activeDishesCount = useMemo(() => {
    return filteredRows.filter((r) => Number(r.total_quantity) > 0).length;
  }, [filteredRows]);

  return (
    <div className="max-w-4xl mx-auto pb-24 pt-2 px-3 sm:px-4">
      {/* Top Header & Realtime Bar */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-xs">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                Màn Hình Quán Ăn / Bếp
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Dữ liệu trực tiếp từ bảng tổng hợp <code>kitchen_summary</code>
              </p>
            </div>
          </div>

          {/* Realtime Status Indicator & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Cập nhật lúc: <strong>{lastUpdateTimeStr}</strong></span>
              </span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              id="btn-refresh-kitchen"
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 transition-colors border border-stone-200 disabled:opacity-50"
              title="Làm mới số liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handlePrint}
              id="btn-print-kitchen"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors shadow-xs"
              title="In phiếu báo bếp"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In phiếu</span>
            </button>
          </div>
        </div>

        {/* Realtime banner description */}
        <div className="mt-3 flex items-center justify-between text-xs text-stone-600 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Tự động cập nhật thời gian thực khi nhân viên đặt hoặc đổi số lượng (Supabase Realtime <code>orders</code>).
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-800 uppercase shrink-0 ml-2">
            Tuần {currentWeeklyMenu?.week_start || 'hiện tại'}
          </span>
        </div>

        {/* Big Metric Numbers for Kitchen Staff */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-3">
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3">
            <p className="text-xs font-medium text-stone-500">Tổng số suất cần nấu</p>
            <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-0.5">
              {totalMeals} <span className="text-sm font-semibold text-stone-500">suất</span>
            </p>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3">
            <p className="text-xs font-medium text-stone-500">Số món có người đặt</p>
            <p className="text-2xl sm:text-3xl font-black text-stone-800 mt-0.5">
              {activeDishesCount} <span className="text-sm font-semibold text-stone-500">món</span>
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-stone-50 border border-stone-200 rounded-2xl p-3 flex flex-col justify-center">
            <p className="text-xs font-medium text-stone-500">Trạng thái đồng bộ</p>
            <div className="flex items-center gap-1.5 mt-1 font-bold text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSupabaseLive ? 'Supabase Realtime' : 'Mô phỏng cục bộ'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
        {/* Day of week filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
          <button
            onClick={() => setSelectedDayFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap ${
              selectedDayFilter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            Cả tuần
          </button>
          {DAYS_OF_WEEK.map((dayDow) => {
            const isSelected = selectedDayFilter === dayDow;
            const countForDay = (groupedByDay.get(dayDow) || []).reduce(
              (sum, r) => sum + Number(r.total_quantity),
              0
            );

            return (
              <button
                key={dayDow}
                onClick={() => setSelectedDayFilter(dayDow)}
                className={`px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span>{DAY_NAMES[dayDow]}</span>
                {countForDay > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-amber-800 text-amber-100' : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {countForDay}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên món..."
            className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Main Table / Grouped List by Day */}
      <div className="space-y-4">
        {DAYS_OF_WEEK
          .filter((d) => selectedDayFilter === 'all' || selectedDayFilter === d)
          .map((dayDow) => {
            const rows = groupedByDay.get(dayDow) || [];
            const dayTotal = rows.reduce((s, r) => s + Number(r.total_quantity), 0);

            return (
              <div
                key={dayDow}
                className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden"
              >
                {/* Day Section Header */}
                <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                      {DAY_NAMES[dayDow]}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-stone-500 font-medium">Tổng ngày:</span>
                    <span className="text-sm font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-xl border border-amber-200">
                      {dayTotal} suất
                    </span>
                  </div>
                </div>

                {/* Rows: Tên món — Tổng số suất */}
                {rows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-400">
                    Không có món ăn nào trong thực đơn ngày này.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {rows.map((row) => {
                      const qty = Number(row.total_quantity) || 0;
                      return (
                        <div
                          key={row.menu_item_id}
                          className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 transition-colors ${
                            qty > 0 ? 'bg-white hover:bg-amber-50/30' : 'bg-stone-50/40 text-stone-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                qty > 0
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-stone-100 text-stone-400'
                              }`}
                            >
                              🍲
                            </div>
                            <div>
                              <p
                                className={`text-sm font-bold leading-snug ${
                                  qty > 0 ? 'text-stone-900' : 'text-stone-400'
                                }`}
                              >
                                {row.item_name}
                              </p>
                              <p className="text-[11px] text-stone-400 mt-0.5">
                                Mã món: <span className="font-mono">{row.menu_item_id.slice(0, 8)}</span>
                              </p>
                            </div>
                          </div>

                          {/* Big Total Quantity Display */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              className={`px-3.5 py-1.5 rounded-xl font-black text-base sm:text-lg flex items-center gap-1 ${
                                qty > 0
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-stone-100 text-stone-400'
                              }`}
                            >
                              <span>{qty}</span>
                              <span className="text-xs font-semibold">suất</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types/database';
import { UtensilsCrossed, ChefHat, ShieldCheck, UserCheck, Database, LogOut, CheckCircle2, AlertTriangle, Info, Terminal } from 'lucide-react';

interface HeaderProps {
  onOpenConfig: () => void;
  onOpenSqlModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenConfig, onOpenSqlModal }) => {
  const {
    activeRole,
    setActiveRole,
    currentUser,
    switchUser,
    isSupabaseLive,
    toastMessage,
  } = useApp();

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Admin Quản trị';
      case 'kitchen':
        return 'Bếp ăn';
      default:
        return 'Nhân viên';
    }
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'kitchen':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      {/* Toast popup */}
      {toastMessage && (
        <div
          className={`px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-stone-800 text-white'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & User profile info */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shrink-0 font-bold text-lg">
              🍱
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-sm sm:text-base text-stone-900 tracking-tight leading-tight">
                  Đặt Cơm Trưa
                </h1>
                {currentUser && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${getRoleBadgeClass(
                      currentUser.role
                    )}`}
                  >
                    {getRoleLabel(currentUser.role)}
                  </span>
                )}
              </div>
              {currentUser ? (
                <p className="text-[11px] sm:text-xs text-stone-600 font-medium truncate max-w-[170px] sm:max-w-none">
                  {currentUser.name} • {currentUser.department || 'Nhân sự'}{' '}
                  {currentUser.transfer_code && (
                    <span className="font-mono text-stone-500 font-normal">({currentUser.transfer_code})</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-stone-500">Chưa đăng nhập</p>
              )}
            </div>
          </div>

          {/* Right actions: Supabase status & Switch User button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onOpenSqlModal && (
              <button
                onClick={onOpenSqlModal}
                id="header-sql-modal-btn"
                className="flex items-center gap-1 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 transition-colors"
                title="Xem và sao chép mã SQL & RLS"
              >
                <Terminal className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-[11px] sm:text-xs">Mã SQL</span>
              </button>
            )}

            {/* Supabase status indicator */}
            <button
              onClick={onOpenConfig}
              id="header-supabase-config-btn"
              className={`flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg border transition-colors ${
                isSupabaseLive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
              }`}
              title="Cấu hình kết nối Supabase"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSupabaseLive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isSupabaseLive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <Database className="w-3.5 h-3.5 hidden xs:inline" />
              <span className="text-[11px] sm:text-xs font-medium">
                {isSupabaseLive ? 'Supabase' : 'Cục bộ'}
              </span>
            </button>

            {/* Switch user button */}
            {currentUser && (
              <button
                onClick={switchUser}
                id="btn-switch-user"
                className="flex items-center gap-1 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 border border-stone-200 px-2.5 py-1.5 rounded-lg transition-colors"
                title="Đổi tài khoản người dùng khác"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-500" />
                <span className="whitespace-nowrap">Đổi người dùng</span>
              </button>
            )}
          </div>
        </div>

        {/* If Admin is logged in, provide view-switch chips to inspect Kitchen or Staff view easily */}
        {currentUser?.role === 'admin' && (
          <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-stone-500 font-medium">
              <span>Chế độ xem:</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveRole('admin')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeRole === 'admin'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Trang Admin
              </button>
              <button
                onClick={() => setActiveRole('kitchen')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeRole === 'kitchen'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Trang Bếp
              </button>
              <button
                onClick={() => setActiveRole('staff')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeRole === 'staff'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Trang Nhân viên
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

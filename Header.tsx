import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types/database';
import { UtensilsCrossed, ChefHat, ShieldCheck, UserCheck, LogOut, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    activeRole,
    setActiveRole,
    currentUser,
    logout,
    switchUser,
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

          {/* Right actions: Logout button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Logout button */}
            {currentUser && (
              <button
                onClick={logout || switchUser}
                id="btn-logout"
                className="flex items-center gap-1 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 border border-stone-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-500" />
                <span className="whitespace-nowrap">Đăng xuất</span>
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
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

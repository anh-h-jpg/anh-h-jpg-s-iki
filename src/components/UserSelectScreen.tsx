import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, UserCheck, Shield, Utensils, Users, Database, Plus, UserPlus, X, Terminal, RefreshCw, Wrench } from 'lucide-react';
import { UserRole } from '../types/database';
import { SqlModal } from './SqlModal';

interface UserSelectScreenProps {
  onOpenConfig: () => void;
}

export const UserSelectScreen: React.FC<UserSelectScreenProps> = ({ onOpenConfig }) => {
  const {
    users,
    claimProfile,
    registerAndClaim,
    seedSupabaseDatabase,
    refreshData,
    actionLoading,
    isSupabaseLive,
  } = useApp();
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | UserRole>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Form "Thêm mới" đăng ký nhân viên mới
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlModalTab, setSqlModalTab] = useState<'fix_rls' | 'seed' | 'setup'>('fix_rls');
  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(search.toLowerCase())) ||
        (u.transfer_code && u.transfer_code.toLowerCase().includes(search.toLowerCase()));

      const matchRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, selectedRoleFilter]);

  const handleSelect = async (userId: string) => {
    setClaimingId(userId);
    await claimProfile(userId);
    setClaimingId(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const ok = await registerAndClaim(newName, newDepartment, newRole);
    if (ok) {
      setShowRegisterForm(false);
      setNewName('');
      setNewDepartment('');
      setNewRole('staff');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            <Shield className="w-3 h-3" />
            Admin
          </span>
        );
      case 'kitchen':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            <Utensils className="w-3 h-3" />
            Bếp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            <Users className="w-3 h-3" />
            Nhân viên
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between max-w-lg mx-auto p-4 sm:p-6">
      <div className="w-full">
        {/* Top bar with Supabase badge */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shadow-orange-600/30 font-bold text-lg">
              🍱
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-tight">Đặt Cơm Trưa</h1>
              <p className="text-[11px] text-stone-500 font-medium">Hệ thống nội bộ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshData()}
              disabled={actionLoading}
              id="btn-refresh-users-top"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition-colors shadow-2xs disabled:opacity-50"
              title="Tải lại danh sách từ Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-stone-600 ${actionLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              onClick={() => {
                setSqlModalTab('fix_rls');
                setShowSqlModal(true);
              }}
              id="btn-open-sql-modal-top"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors shadow-2xs"
              title="Xem và sao chép mã SQL để sửa lỗi RLS 42501"
            >
              <Wrench className="w-3.5 h-3.5 text-rose-600" />
              <span>Mã SQL &amp; RLS</span>
            </button>

            <button
              onClick={() => setShowRegisterForm(true)}
              id="btn-open-register-user"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Thêm mới</span>
            </button>

            <button
              onClick={onOpenConfig}
              id="user-select-config-btn"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                isSupabaseLive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSupabaseLive ? 'Supabase Live' : 'Cấu hình'}</span>
            </button>
          </div>
        </div>

        {/* Title greeting */}
        <div className="mt-5 mb-3">
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Bạn là ai? 👋
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Chọn tài khoản của bạn để vào đặt cơm hoặc quản trị.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="search-user-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc phòng ban..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 shadow-xs placeholder:text-stone-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 px-1"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setSelectedRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              selectedRoleFilter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            Tất cả ({users.length})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('staff')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              selectedRoleFilter === 'staff'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            Nhân viên ({users.filter((u) => u.role === 'staff').length})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('kitchen')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              selectedRoleFilter === 'kitchen'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            Bếp ({users.filter((u) => u.role === 'kitchen').length})
          </button>
          <button
            onClick={() => setSelectedRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
              selectedRoleFilter === 'admin'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            Admin ({users.filter((u) => u.role === 'admin').length})
          </button>
        </div>

        {/* Users list */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {filteredUsers.length === 0 ? (
            users.length === 0 && isSupabaseLive ? (
              <div className="text-center py-6 px-4 bg-white rounded-2xl border border-rose-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Đã kết nối Supabase của bạn</h3>
                  <p className="text-xs text-stone-600 mt-1 max-w-md mx-auto leading-relaxed">
                    Nếu bạn vừa chạy Seed Data và thấy thông báo <code className="bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">"Success. No rows returned"</code>, dữ liệu <strong>đã được tạo thành công</strong> trên database!
                    Nếu danh sách chưa hiện hoặc gặp lỗi 42501, chính sách RLS đang chặn đọc ẩn danh.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSqlModalTab('fix_rls');
                      setShowSqlModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>1. Lấy mã Sửa lỗi RLS 42501</span>
                  </button>

                  <button
                    onClick={() => refreshData()}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                    <span>2. Tải lại dữ liệu (Refresh)</span>
                  </button>

                  <button
                    onClick={() => seedSupabaseDatabase()}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 disabled:opacity-50 transition-colors"
                  >
                    <span>⚡ Nạp dữ liệu mẫu</span>
                  </button>

                  <button
                    onClick={() => setShowRegisterForm(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tự thêm tài khoản</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-stone-200 p-4">
                <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">Chưa có hoặc không tìm thấy người dùng</p>
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold shadow-xs hover:bg-orange-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm nhân viên mới ngay</span>
                </button>
              </div>
            )
          ) : (
            filteredUsers.map((u) => {
              const isClaiming = claimingId === u.id;
              return (
                <button
                  key={u.id}
                  id={`user-select-${u.id}`}
                  onClick={() => handleSelect(u.id)}
                  disabled={actionLoading}
                  className="w-full text-left bg-white hover:bg-orange-50/40 active:bg-orange-100/60 p-3 sm:p-3.5 rounded-2xl border border-stone-200 transition-all flex items-center justify-between group shadow-xs hover:border-orange-200 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-orange-100 text-stone-700 group-hover:text-orange-700 flex items-center justify-center font-bold text-sm transition-colors border border-stone-200/60">
                      {u.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(-2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-stone-900 flex items-center gap-2">
                        {u.name}
                      </div>
                      <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                        <span>{u.department || 'Nhân sự'}</span>
                        {u.transfer_code && (
                          <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded border border-stone-200">
                            {u.transfer_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getRoleBadge(u.role)}
                    {isClaiming ? (
                      <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin ml-1" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-stone-300 group-hover:text-orange-600 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-4 pt-3 border-t border-stone-200 text-center">
        <p className="text-xs text-stone-500">
          💡 Chọn đúng tên của bạn. Sau khi chọn, hệ thống sẽ tự động ghi nhớ trên thiết bị này.
        </p>
      </div>

      {/* Modal: Form "Thêm mới" qua RPC register_and_claim */}
      {showRegisterForm && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-stone-900">Thêm thành viên mới</h3>
                  <p className="text-[11px] text-stone-500">Tạo hồ sơ và tự động đăng nhập</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterForm(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Bình"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Phòng ban (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Ví dụ: Kỹ thuật, Marketing..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Vai trò tài khoản
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('staff')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-colors ${
                      newRole === 'staff'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    Nhân viên
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('kitchen')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-colors ${
                      newRole === 'kitchen'
                        ? 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    Bếp ăn
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-colors ${
                      newRole === 'admin'
                        ? 'border-purple-600 bg-purple-50 text-purple-800'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    Quản trị
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-600">
                Tài khoản tạo mới sẽ được lưu trực tiếp vào cơ sở dữ liệu và tự động đăng nhập.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Đang tạo...' : 'Tạo & Đăng nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL & RLS Script Modal */}
      <SqlModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        initialTab={sqlModalTab}
      />
    </div>
  );
};

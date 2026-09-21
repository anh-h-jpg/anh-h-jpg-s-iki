import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getSupabaseCredentials } from '../lib/supabase';
import { SUPABASE_SETUP_SQL } from '../lib/schemaSql';
import {
  X,
  Database,
  Key,
  RotateCcw,
  Radio,
  Info,
  CheckCircle2,
  Code2,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ isOpen, onClose }) => {
  const {
    users,
    weeklyMenus,
    orders,
    seedSupabaseDatabase,
    saveSupabaseConfig,
    disconnectSupabase,
    resetDemoData,
    isSupabaseLive,
    actionLoading,
  } = useApp();

  const creds = getSupabaseCredentials();
  const [url, setUrl] = useState(creds.url);
  const [key, setKey] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'sql' | 'guide'>('config');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await saveSupabaseConfig(url, key);
    setIsSubmitting(false);
    setStatusMessage({
      text: res.message,
      isError: !res.success,
    });
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Kết Nối Supabase Project
              </h2>
              <p className="text-xs text-stone-500">
                {isSupabaseLive ? 'Đang kết nối trực tiếp với Supabase' : 'Chế độ hoạt động cục bộ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 px-5 pt-2 bg-stone-50/50">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Cấu hình API</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'sql'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Mã SQL &amp; RLS</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Thông tin &amp; Schema</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-stone-800">
          {activeTab === 'config' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div>
                    <span className="font-bold">Trạng thái hiện tại: </span>
                    {isSupabaseLive ? (
                      <span className="text-emerald-700 font-semibold">
                        ● Supabase Trực Tiếp (Live Realtime)
                      </span>
                    ) : (
                      <span>
                        Chưa cấu hình Supabase hoặc đang dùng dữ liệu mô phỏng cục bộ.
                      </span>
                    )}
                  </div>
                  {isSupabaseLive && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2 rounded-xl mt-1 space-y-1.5">
                      <div className="font-semibold">Dữ liệu đọc được từ Supabase của bạn:</div>
                      <div className="grid grid-cols-3 gap-1 font-medium">
                        <div>👥 Nhân viên: <strong>{users.length}</strong></div>
                        <div>📅 Thực đơn: <strong>{weeklyMenus.length}</strong></div>
                        <div>🍱 Suất ăn: <strong>{orders.length}</strong></div>
                      </div>
                      {users.length === 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => seedSupabaseDatabase()}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-[11px] shadow-xs disabled:opacity-50"
                          >
                            <Zap className="w-3 h-3" />
                            <span>{actionLoading ? 'Đang nạp...' : '⚡ Nạp dữ liệu mẫu vào Supabase'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Supabase Project URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Lấy từ Supabase Dashboard &gt; Project Settings &gt; API &gt; Project URL
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Supabase Anon Key (Public API Key)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Lấy từ Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon public)
                </p>
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-2xl text-xs font-medium ${
                    statusMessage.isError
                      ? 'bg-rose-50 border border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      disconnectSupabase();
                      setUrl('');
                      setKey('');
                      setStatusMessage({ text: 'Đã ngắt kết nối Supabase.', isError: false });
                    }}
                    className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
                  >
                    Ngắt kết nối
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetDemoData();
                      setStatusMessage({ text: 'Đã làm mới dữ liệu mô phỏng cục bộ!', isError: false });
                    }}
                    className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Làm mới mẫu</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang kiểm tra...' : 'Kiểm tra & Lưu Kết Nối'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-xs text-orange-950 space-y-2">
                <h4 className="font-bold flex items-center gap-1.5 text-orange-900">
                  <span>💡 Hướng dẫn cấu hình SQL &amp; Mở quyền RLS</span>
                </h4>
                <p>
                  Để app hoạt động ổn định và có quyền đọc/ghi trên Supabase (Realtime, RLS chính sách đọc/ghi cho anon key, và hàm chốt hóa đơn):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-stone-700 font-medium">
                  <li>Mở <strong>Supabase Dashboard</strong> &gt; chọn dự án của bạn.</li>
                  <li>Vào mục <strong>SQL Editor</strong> ở thanh menu bên trái.</li>
                  <li>Nhấn <strong>New Query</strong>, dán toàn bộ mã SQL bên dưới và bấm <strong>Run</strong>.</li>
                </ol>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-700 uppercase tracking-wider">
                  Mã SQL Thiết Lập &amp; Mở Quyền RLS
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors shadow-xs"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
                </button>
              </div>

              <pre className="p-3.5 bg-stone-900 text-stone-200 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-[320px] border border-stone-800 leading-relaxed select-all">
                {SUPABASE_SETUP_SQL}
              </pre>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-stone-700">
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-stone-900">Chuẩn kết nối Supabase</h4>
                    <p className="text-stone-600 mt-0.5 text-xs">
                      Ứng dụng giao tiếp 100% qua API Supabase client chuẩn, tuân thủ chính xác schema database đã có:
                    </p>
                    <ul className="list-disc list-inside mt-1.5 space-y-1 text-xs text-stone-600">
                      <li><code>users</code>: Danh sách nhân viên, vai trò (staff, admin, kitchen), transfer_code.</li>
                      <li><code>weekly_menus</code> &amp; <code>menu_items</code>: Menu theo chuỗi ngày (monday - friday).</li>
                      <li><code>orders</code>: Suất ăn từng ngày, cập nhật realtime cho bếp.</li>
                      <li><code>payments</code> &amp; <code>feedback</code>: Hóa đơn tuần và đánh giá sao kèm nhận xét.</li>
                      <li>RPCs: <code>claim_profile</code>, <code>register_and_claim</code>, <code>generate_payments</code>, <code>confirm_payment</code>.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

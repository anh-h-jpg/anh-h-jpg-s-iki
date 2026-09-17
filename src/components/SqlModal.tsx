import React, { useState } from 'react';
import { SUPABASE_SETUP_SQL, SUPABASE_SEED_SQL, SUPABASE_FIX_RLS_SQL } from '../lib/schemaSql';
import { X, Copy, Check, Terminal, ExternalLink, ShieldCheck, Database, Wrench } from 'lucide-react';

interface SqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'fix_rls' | 'seed' | 'setup';
}

export const SqlModal: React.FC<SqlModalProps> = ({ isOpen, onClose, initialTab = 'fix_rls' }) => {
  const [activeTab, setActiveTab] = useState<'fix_rls' | 'seed' | 'setup'>(initialTab);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  let currentSql = SUPABASE_FIX_RLS_SQL;
  if (activeTab === 'seed') currentSql = SUPABASE_SEED_SQL;
  if (activeTab === 'setup') currentSql = SUPABASE_SETUP_SQL;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">
                Mã SQL Supabase &amp; Sửa lỗi RLS
              </h2>
              <p className="text-xs text-stone-500">
                Chạy trong Supabase SQL Editor để cấu hình bảng, mở quyền RLS và nạp dữ liệu mẫu
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

        {/* Tab Selection */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 px-4 pt-2 gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('fix_rls');
              setCopied(false);
            }}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'fix_rls'
                ? 'bg-white text-rose-600 border-rose-600 shadow-2xs'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Wrench className="w-4 h-4 text-rose-500" />
            <span>Sửa lỗi RLS 42501</span>
            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded-full">
              Khắc phục
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('seed');
              setCopied(false);
            }}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'seed'
                ? 'bg-white text-orange-600 border-orange-600 shadow-2xs'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Database className="w-4 h-4 text-orange-500" />
            <span>Dữ Liệu Mẫu (seed_data.sql)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('setup');
              setCopied(false);
            }}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 shrink-0 ${
              activeTab === 'setup'
                ? 'bg-white text-stone-900 border-stone-800 shadow-2xs'
                : 'text-stone-600 border-transparent hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-stone-500" />
            <span>Cài Đặt Đầy Đủ (full_setup.sql)</span>
          </button>
        </div>

        {/* Modal content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-stone-800">
          {/* Instructions */}
          {activeTab === 'fix_rls' && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-950 space-y-2">
              <div className="font-bold flex items-center gap-2 text-rose-900 text-sm">
                <Wrench className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Khắc phục lỗi "Supabase RLS đang chặn ghi dữ liệu (mã 42501)":</span>
              </div>
              <p className="text-stone-700 leading-relaxed">
                Khi bạn chạy script seed data trong Supabase và thấy <strong>"Success. No rows returned"</strong>, nghĩa là <strong>dữ liệu đã được nạp thành công</strong> vào cơ sở dữ liệu. Lỗi 42501 xuất hiện do chính sách RLS hiện tại đang chặn người dùng ẩn danh đọc và ghi bảng.
              </p>
              <div className="bg-white/80 p-2.5 rounded-xl border border-rose-200 text-rose-900 font-medium">
                👉 <strong>Chỉ cần làm 2 bước:</strong>
                <ol className="list-decimal list-inside space-y-1 mt-1 text-stone-800">
                  <li>Bấm nút <strong>"Sao chép mã Sửa lỗi RLS"</strong> bên dưới.</li>
                  <li>Dán vào <strong>Supabase SQL Editor</strong> &gt; Nhấn <strong>Run</strong>. Sau đó quay lại app bấm nút <strong>"Tải lại dữ liệu"</strong> là xong!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'seed' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-2">
              <div className="font-bold flex items-center gap-2 text-emerald-900 text-sm">
                <Database className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Nạp Dữ Liệu Mẫu (seed_data.sql):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-stone-700 font-medium pl-1 leading-relaxed">
                <li>
                  Tạo sẵn 7 tài khoản: <strong>Admin Test</strong>, <strong>Bếp Test</strong>, và 5 nhân viên (<strong>Nguyễn Văn A (U001)</strong> ... <strong>Hoàng Văn E (U005)</strong>).
                </li>
                <li>
                  Tạo sẵn <strong>Thực đơn tuần Thứ 2 - Thứ 6</strong> (2 món/ngày, 35.000đ – 40.000đ).
                </li>
                <li>
                  Khi chạy trong Supabase SQL Editor, hệ thống báo <strong>"Success. No rows returned"</strong> là <strong>hoàn toàn bình thường và thành công 100%</strong>!
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-xs text-orange-950 space-y-2">
              <div className="font-bold flex items-center gap-2 text-orange-900 text-sm">
                <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                <span>Cài Đặt Toàn Diện Bảng, Views, RLS &amp; Realtime:</span>
              </div>
              <p className="text-stone-700 leading-relaxed">
                Dùng khi khởi tạo dự án Supabase mới từ đầu. Đã bao gồm các bảng, view tổng hợp bếp, view chốt tiền admin và chính sách RLS mở quyền.
              </p>
            </div>
          )}

          {/* Action copy button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <span className="font-bold text-xs text-stone-700 uppercase tracking-wider">
              {activeTab === 'fix_rls'
                ? 'Mã SQL Mở Quyền RLS (Fix mã lỗi 42501)'
                : activeTab === 'seed'
                ? 'Mã SQL Seed Data (7 tài khoản & Thực đơn T2-T6)'
                : 'Mã SQL Toàn Diện (full_setup.sql)'}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : activeTab === 'fix_rls'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>
                {copied
                  ? 'Đã sao chép thành công!'
                  : `Sao chép mã ${
                      activeTab === 'fix_rls'
                        ? 'Sửa lỗi RLS'
                        : activeTab === 'seed'
                        ? 'Seed Data'
                        : 'Setup'
                    }`}
              </span>
            </button>
          </div>

          {/* Code box */}
          <div className="relative">
            <pre className="p-4 bg-stone-900 text-stone-100 rounded-2xl text-[11px] sm:text-xs font-mono overflow-x-auto max-h-[380px] border border-stone-800 leading-relaxed select-all">
              {currentSql}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-xs text-stone-500 hidden sm:inline">
            Sau khi chạy xong trên Supabase, quay lại ứng dụng để thấy ngay danh sách nhân viên và thực đơn!
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors"
            >
              {copied ? '✓ Đã copy' : 'Copy SQL'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

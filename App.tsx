import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { EmployeeView } from './components/EmployeeView';
import { KitchenView } from './components/KitchenView';
import { AdminView } from './components/AdminView';
import { UserSelectScreen } from './components/UserSelectScreen';
import { WifiOff, RefreshCw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { currentUser, activeRole, loading, connectionError, retryConnection, actionLoading } = useApp();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryConnection();
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-600">Đang khởi tạo ứng dụng đặt cơm...</p>
        </div>
      </div>
    );
  }

  // Connection Error Screen: hiện khi không kết nối được máy chủ Supabase
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-8">
        <div
          id="connection-error-card"
          className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-5 border border-rose-100">
            <WifiOff className="w-8 h-8" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mb-2">
            Không kết nối được máy chủ
          </h1>

          <p className="text-sm text-stone-600 mb-6 leading-relaxed">
            Hệ thống không thể kết nối tới cơ sở dữ liệu máy chủ để tải thực đơn và đơn hàng. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.
          </p>

          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 mb-6 text-left break-words font-mono">
            <span className="font-sans font-bold text-stone-700 block mb-1">Chi tiết lỗi:</span>
            {connectionError}
          </div>

          <button
            type="button"
            id="btn-retry-connection"
            onClick={handleRetry}
            disabled={retrying || actionLoading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-sm shadow-md shadow-orange-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${retrying || actionLoading ? 'animate-spin' : ''}`} />
            <span>{retrying || actionLoading ? 'Đang thử lại...' : 'Thử lại'}</span>
          </button>
        </div>
      </div>
    );
  }

  // If no user profile has been claimed yet, show "Bạn là ai?"
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-stone-50">
        <UserSelectScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-orange-200">
      {/* Header */}
      <Header />

      {/* Main Content Area based on role */}
      <main className="flex-1">
        {activeRole === 'staff' && <EmployeeView />}
        {activeRole === 'kitchen' && <KitchenView />}
        {activeRole === 'admin' && <AdminView />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}

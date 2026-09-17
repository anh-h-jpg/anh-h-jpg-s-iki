import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { EmployeeView } from './components/EmployeeView';
import { KitchenView } from './components/KitchenView';
import { AdminView } from './components/AdminView';
import { UserSelectScreen } from './components/UserSelectScreen';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { SqlModal } from './components/SqlModal';

const MainApp: React.FC = () => {
  const { currentUser, activeRole, loading } = useApp();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

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

  // If no user profile has been claimed yet, show "Bạn là ai?"
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-stone-50">
        <UserSelectScreen onOpenConfig={() => setShowConfigModal(true)} />
        <SupabaseConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-orange-200">
      {/* Header */}
      <Header
        onOpenConfig={() => setShowConfigModal(true)}
        onOpenSqlModal={() => setShowSqlModal(true)}
      />

      {/* Main Content Area based on role */}
      <main className="flex-1">
        {activeRole === 'staff' && <EmployeeView />}
        {activeRole === 'kitchen' && <KitchenView />}
        {activeRole === 'admin' && <AdminView />}
      </main>

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />

      {/* SQL & RLS Modal */}
      <SqlModal
        isOpen={showSqlModal}
        onClose={() => setShowSqlModal(false)}
      />
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

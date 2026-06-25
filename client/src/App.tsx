import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import WorkspacePage from './components/WorkspacePage';
import DocumentEditor from './components/DocumentEditor';
import AnalyticsPage from './components/AnalyticsPage';
import AuditPage from './components/AuditPage';
import SettingsPage from './components/SettingsPage';
import OnboardingPage from './components/OnboardingPage';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import ChatPanel from './components/ChatPanel';

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-canvas-soft">
      <div className="text-center">
        <div className="w-10 h-10 rounded-lg bg-ink flex items-center justify-center mx-auto mb-4">
          <span className="text-on-primary text-sm font-semibold font-mono">SF</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <div className="w-2 h-2 rounded-full bg-ink animate-pulse-dot" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-ink animate-pulse-dot" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-ink animate-pulse-dot" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm text-mute mt-3">Loading workspace...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { state, dispatch, fetchWorkspaces } = useApp();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!state.isAuthenticated) return;
    fetchWorkspaces();
  }, [state.isAuthenticated, fetchWorkspaces]);

  // Trigger onboarding when an authenticated admin/manager has zero workspaces.
  useEffect(() => {
    if (!state.isAuthenticated || state.isLoading) return;
    const canCreate = state.user?.role === 'admin' || state.user?.role === 'finance_manager';
    if (!canCreate) return;

    const timer = setTimeout(() => {
      if (state.workspaces.length === 0) setNeedsOnboarding(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [state.isAuthenticated, state.workspaces.length, state.isLoading, state.user?.role]);

  if (state.isLoading) return <LoadingScreen />;

  // Public pages — no auth required.
  if (state.currentPage === 'landing') return <LandingPage />;
  if (state.currentPage === 'login') return <AuthPage mode="login" />;
  if (state.currentPage === 'register') return <AuthPage mode="register" />;

  // Auth guard — bounce back to landing if the session was cleared.
  if (!state.isAuthenticated) return <LandingPage />;

  if (needsOnboarding && state.currentPage === 'dashboard') {
    return (
      <OnboardingPage
        onComplete={() => {
          setNeedsOnboarding(false);
          fetchWorkspaces();
        }}
      />
    );
  }

  const renderPage = () => {
    switch (state.currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'workspace': return <WorkspacePage />;
      case 'document': return <DocumentEditor />;
      case 'analytics': return <AnalyticsPage />;
      case 'audit': return <AuditPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  const showChat =
    state.chatOpen &&
    (state.currentPage === 'workspace' || state.currentPage === 'document');

  return (
    <div className="h-screen flex bg-canvas-soft overflow-hidden">
      <div className="hidden lg:flex h-full">
        <Sidebar />
      </div>

      {state.sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          />
          <div className="relative z-10 h-full">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-canvas-soft">{renderPage()}</main>
          {showChat && <ChatPanel />}
        </div>
      </div>

      {!state.isConnected && state.isAuthenticated && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-warning-soft text-warning-deep border border-warning/30 text-sm px-4 py-2 rounded-full elev-popover flex items-center gap-2 z-50">
          <span className="w-2 h-2 rounded-full bg-warning-deep animate-pulse" />
          Reconnecting...
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

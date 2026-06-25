import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  Menu, Bell, MessageSquare, ChevronRight
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function TopBar() {
  const { state, dispatch, navigate } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const currentWorkspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
  const currentDocument = state.documents.find((d) => d.id === state.currentDocumentId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkOneRead = (id: string) => {
    // Optimistic update — fire the API in the background.
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
    setNotifOpen(false);
    void api.markNotificationRead(id);
  };

  const handleMarkAllRead = () => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    void api.markAllNotificationsRead();
  };

  // Breadcrumbs
  const crumbs: { label: string; page?: string }[] = [];
  if (state.currentPage === 'dashboard') {
    crumbs.push({ label: 'Dashboard' });
  } else if (state.currentPage === 'workspace' && currentWorkspace) {
    crumbs.push({ label: 'Dashboard', page: 'dashboard' });
    crumbs.push({ label: currentWorkspace.name });
  } else if (state.currentPage === 'document' && currentDocument) {
    crumbs.push({ label: 'Dashboard', page: 'dashboard' });
    if (currentWorkspace) crumbs.push({ label: currentWorkspace.name, page: 'workspace' });
    crumbs.push({ label: currentDocument.title });
  } else if (state.currentPage === 'analytics') {
    crumbs.push({ label: 'Analytics' });
  } else if (state.currentPage === 'audit') {
    crumbs.push({ label: 'Audit log' });
  } else if (state.currentPage === 'settings') {
    crumbs.push({ label: 'Settings' });
  }

  return (
    <header className="h-14 bg-canvas border-b border-hairline flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        className="text-body hover:text-ink transition-colors lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
        {crumbs.map((crumb, i) => (
          <div key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-mute flex-shrink-0" />}
            {crumb.page ? (
              <button
                onClick={() => navigate(crumb.page as any)}
                className="text-body hover:text-ink transition-colors truncate"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-ink font-medium truncate">{crumb.label}</span>
            )}
          </div>
        ))}
      </nav>

      {/* Chat toggle */}
      {(state.currentPage === 'workspace' || state.currentPage === 'document') && (
        <button
          onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
          className={`relative p-2 rounded-md transition-colors ${
            state.chatOpen ? 'bg-canvas-soft2 text-ink' : 'text-body hover:text-ink hover:bg-canvas-soft2'
          }`}
          title="Toggle chat"
        >
          <MessageSquare className="w-4.5 h-4.5" />
        </button>
      )}

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative p-2 rounded-md text-body hover:text-ink hover:bg-canvas-soft2 transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-error text-on-accent text-[10px] font-medium rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-canvas border border-hairline rounded-lg elev-popover overflow-hidden z-50 animate-fadeIn">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <h3 className="text-sm font-medium text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-link hover:text-link-deep transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {state.notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-mute">No notifications</div>
              ) : (
                state.notifications.slice(0, 8).map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleMarkOneRead(notif.id)}
                    className={`w-full text-left px-4 py-3 border-b border-hairline last:border-b-0 hover:bg-canvas-soft2 transition-colors ${
                      !notif.read ? 'bg-link-bg-soft' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-link flex-shrink-0 mt-1.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-ink font-medium truncate">{notif.title}</p>
                        <p className="text-xs text-body mt-0.5">{notif.message}</p>
                        <p className="text-[11px] text-mute mt-1">
                          {new Date(notif.createdAt || notif.timestamp || '').toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

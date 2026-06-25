import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard, FolderOpen, BarChart3, Settings, ClipboardList,
  LogOut, ChevronDown, Plus, Users
} from 'lucide-react';
import { useState } from 'react';
import type { Page } from '../../types';
import { CreateWorkspaceModal } from '../forms/WorkspaceForms';

export default function Sidebar() {
  const { state, navigate, openWorkspace, logout } = useApp();
  const [wsExpanded, setWsExpanded] = useState(true);
  const [showCreateWs, setShowCreateWs] = useState(false);

  // Only admins and finance managers can create workspaces
  const canCreateWorkspace = state.user?.role === 'admin' || state.user?.role === 'finance_manager';

  const navItems: { icon: typeof LayoutDashboard; label: string; page: Page }[] = [
    { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
    { icon: BarChart3, label: 'Analytics', page: 'analytics' },
    { icon: ClipboardList, label: 'Audit log', page: 'audit' },
    { icon: Settings, label: 'Settings', page: 'settings' },
  ];

  return (
    <aside className={`${state.sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'} flex-shrink-0 bg-canvas border-r border-hairline h-full flex flex-col transition-all duration-200`}>
      <div className="p-4 border-b border-hairline">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center flex-shrink-0">
            <span className="text-on-primary text-xs font-semibold font-mono">SF</span>
          </div>
          <span className="text-ink font-semibold text-sm tracking-[-0.3px] truncate">SyncFinance</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2 space-y-0.5">
          {navItems.map(({ icon: Icon, label, page }) => (
            <button
              key={page}
              onClick={() => navigate(page)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                state.currentPage === page
                  ? 'bg-canvas-soft2 text-ink font-medium'
                  : 'text-body hover:text-ink hover:bg-canvas-soft2'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 px-2">
          <button
            onClick={() => setWsExpanded(!wsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-mute uppercase tracking-wider hover:text-body transition-colors"
          >
            <span>Workspaces</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${wsExpanded ? '' : '-rotate-90'}`} />
          </button>

          {wsExpanded && (
            <div className="mt-1 space-y-0.5">
              {state.workspaces.map(ws => {
                const memberCount = ws.members.length;
                return (
                  <button
                    key={ws.id}
                    onClick={() => openWorkspace(ws.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors group ${
                      state.currentWorkspaceId === ws.id && state.currentPage === 'workspace'
                        ? 'bg-canvas-soft2 text-ink font-medium'
                        : 'text-body hover:text-ink hover:bg-canvas-soft2'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{ws.name}</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-mute opacity-0 group-hover:opacity-100 transition-opacity">
                      <Users className="w-3 h-3" />
                      {memberCount}
                    </span>
                  </button>
                );
              })}
              {canCreateWorkspace && (
                <button
                  onClick={() => setShowCreateWs(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-mute hover:text-ink hover:bg-canvas-soft2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New workspace</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateWs && <CreateWorkspaceModal onClose={() => setShowCreateWs(false)} />}

      {/* User section with REAL connection status */}
      <div className="border-t border-hairline p-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-accent text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: state.user?.color || '#60a5fa' }}
            >
              {state.user?.avatar}
            </div>
            {/* Connection status indicator */}
            <div 
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-canvas ${
                state.isConnected ? 'bg-cyan-deep' : 'bg-mute'
              }`}
              title={state.isConnected ? 'Connected' : 'Offline'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{state.user?.name}</p>
            <p className="text-xs text-mute truncate capitalize">{state.user?.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={logout}
            className="text-mute hover:text-error transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

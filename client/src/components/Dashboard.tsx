import { useApp } from '../context/AppContext';
import {
  TrendingUp, TrendingDown, FileSpreadsheet,
  Users, ArrowRight, Activity, Rocket
} from 'lucide-react';
import { useState } from 'react';
import { CreateWorkspaceModal } from './forms/WorkspaceForms';
import type { AuditLog } from '../types';

function formatAuditDetails(details: AuditLog['details']): string {
  if (!details) return '';
  if (typeof details === 'string') return details;
  try {
    return Object.entries(details)
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ');
  } catch {
    return '';
  }
}

export default function Dashboard() {
  const { state, openWorkspace, getMemberProfile } = useApp();
  const [showCreateWs, setShowCreateWs] = useState(false);

  // Only admins and finance managers can create workspaces
  const canCreateWorkspace = state.user?.role === 'admin' || state.user?.role === 'finance_manager';

  // Real counts from API data
  const totalDocs = state.documents.length;
  const onlineCount = state.onlineUsers.size;
  const totalWorkspaces = state.workspaces.length;
  const unreadNotifications = state.notifications.filter(n => !n.read).length;

  const recentDocs = state.documents.slice(0, 4).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const recentLogs = state.auditLogs.slice(0, 5);

  // Show create button only for admin/finance_manager
  if (totalWorkspaces === 0) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto animate-fadeIn">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink">
            Welcome, {state.user?.name?.split(' ')[0]}.
          </h1>
          <p className="text-sm text-body mt-1">You don't have any workspaces yet. {canCreateWorkspace ? "Let's create one." : 'Ask an Admin to add you to a workspace.'}</p>
        </div>

        <div className="bg-canvas border border-hairline border-dashed rounded-xl p-12 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-ink/5 mb-4">
            <Rocket className="w-6 h-6 text-ink" />
          </div>
          <h2 className="text-lg font-semibold tracking-[-0.3px] text-ink mb-2">
            {canCreateWorkspace ? 'Create your first workspace' : 'No workspaces yet'}
          </h2>
          <p className="text-sm text-body mb-6 max-w-md mx-auto">
            {canCreateWorkspace
              ? 'A workspace is a shared space where your team can collaborate on financial documents, budgets, and forecasts.'
              : 'You will appear here once an admin adds you to a workspace.'}
          </p>
          {canCreateWorkspace && (
            <button
              onClick={() => setShowCreateWs(true)}
              className="bg-ink text-on-primary text-sm font-medium px-5 py-2.5 rounded-full hover:bg-ink/90 transition-colors inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Create workspace
            </button>
          )}
        </div>

        {showCreateWs && <CreateWorkspaceModal onClose={() => setShowCreateWs(false)} />}
      </div>
    );
  }

  const stats = [
    { label: 'Workspaces', value: totalWorkspaces.toString(), change: 'Active', up: true, icon: FileSpreadsheet, color: '#60a5fa' },
    { label: 'Documents', value: totalDocs.toString(), change: `${recentDocs.length} recent`, up: true, icon: FileSpreadsheet, color: '#a78bfa' },
    { label: 'Team members online', value: onlineCount.toString(), change: 'Active now', up: onlineCount > 0, icon: Users, color: '#34d399' },
    { label: 'Unread notifications', value: unreadNotifications.toString(), change: 'Pending', up: false, icon: Activity, color: '#f472b6' },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fadeIn">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink">
            Welcome back, {state.user?.name?.split(' ')[0]}.
          </h1>
          <p className="text-sm text-body mt-1">Here's an overview of your financial workspaces.</p>
        </div>
        {canCreateWorkspace && (
          <button
            onClick={() => setShowCreateWs(true)}
            className="bg-ink text-on-primary text-sm font-medium px-4 py-2 rounded-full hover:bg-ink/90 transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            New workspace
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, change, up, icon: Icon, color }) => (
          <div key={label} className="bg-canvas border border-hairline rounded-lg p-5 elev-card elev-card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-mute font-mono uppercase tracking-wider">{label}</span>
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: color + '22' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-[-0.96px] text-ink">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {up ? <TrendingUp className="w-3.5 h-3.5 text-cyan-deep" /> : <TrendingDown className="w-3.5 h-3.5 text-mute" />}
              <span className={`text-xs ${up ? 'text-cyan-deep' : 'text-mute'}`}>{change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspaces */}
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <h2 className="text-base font-semibold tracking-[-0.3px] text-ink mb-5">Your workspaces</h2>
          <div className="space-y-2">
            {state.workspaces.map(ws => {
              const docCount = state.documents.filter(d => d.workspaceId === ws.id).length;
              return (
                <button
                  key={ws.id}
                  onClick={() => openWorkspace(ws.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-canvas-soft2 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-md bg-canvas-soft2 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{ws.name}</p>
                    <p className="text-xs text-mute">{ws.members.length} members · {docCount} docs</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-mute opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent activity - REAL DATA */}
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold tracking-[-0.3px] text-ink">Recent activity</h2>
            {state.isConnected && (
              <span className="flex items-center gap-1.5 text-xs text-cyan-deep">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-deep animate-pulse-dot" />
                Live
              </span>
            )}
          </div>
          <div className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-mute text-center py-8">
                Activity will appear here as you and your team work.
              </p>
            ) : (
              recentLogs.map(log => {
                const profile = getMemberProfile(log.userId);
                const userColor = profile?.color || '#888';
                const userAvatar = profile?.avatar || log.userId.slice(0, 2).toUpperCase();
                const userName = profile?.name || log.userName || 'Unknown';
                const detailStr = formatAuditDetails(log.details);
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-on-accent text-[9px] font-medium"
                      style={{ backgroundColor: userColor }}
                    >
                      {userAvatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{userName}</span>{' '}
                        <span className="text-body capitalize">{log.action}</span>
                      </p>
                      {detailStr && <p className="text-xs text-mute mt-0.5 truncate">{detailStr}</p>}
                      <p className="text-[11px] text-mute mt-0.5">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showCreateWs && <CreateWorkspaceModal onClose={() => setShowCreateWs(false)} />}
    </div>
  );
}

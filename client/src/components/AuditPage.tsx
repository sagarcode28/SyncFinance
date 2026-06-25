import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Filter, Clock, FileSpreadsheet, Users, Shield } from 'lucide-react';
import type { AuditLog } from '../types';

const actionIcons: Record<string, typeof Clock> = {
  create: FileSpreadsheet,
  update: Clock,
  delete: Shield,
  view: Shield,
  invite: Users,
  remove: Users,
  login: Shield,
  logout: Shield,
  lock: Shield,
  unlock: Shield,
};

/** Safely convert an audit log's details field to a readable string */
function formatDetails(details: AuditLog['details']): string {
  if (!details) return '';
  if (typeof details === 'string') return details;
  try {
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ');
  } catch {
    return JSON.stringify(details);
  }
}

export default function AuditPage() {
  const { state, getMemberProfile } = useApp();
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('all');

  const uniqueUsers = useMemo(
    () => [...new Set(state.auditLogs.map(l => l.userId))],
    [state.auditLogs]
  );

  const logs = useMemo(() => {
    const searchLower = search.toLowerCase();
    return state.auditLogs
      .filter(l => filterUser === 'all' || l.userId === filterUser)
      .filter(l => {
        const detailStr = formatDetails(l.details).toLowerCase();
        const memberProfile = getMemberProfile(l.userId);
        const userName = memberProfile?.name || l.userName || '';
        return (
          detailStr.includes(searchLower) ||
          userName.toLowerCase().includes(searchLower) ||
          l.action.toLowerCase().includes(searchLower)
        );
      });
  }, [state.auditLogs, search, filterUser, getMemberProfile]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink">Audit log.</h1>
        <p className="text-sm text-body mt-1">Complete history of all actions across workspaces.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center bg-canvas border border-hairline rounded-md px-3 h-9 flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-mute mr-2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-ink placeholder:text-mute focus:outline-none w-full"
            placeholder="Search audit logs..."
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-mute" />
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="h-9 px-3 bg-canvas border border-hairline rounded-md text-sm text-ink focus:outline-none"
          >
            <option value="all">All users</option>
            {uniqueUsers.map(uid => {
              const profile = getMemberProfile(uid);
              const name = profile?.name || state.users.find(u => u.id === uid)?.name;
              return name ? (
                <option key={uid} value={uid}>{name}</option>
              ) : null;
            })}
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-canvas border border-hairline rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-canvas-soft2 border-b border-hairline">
                <th className="text-left text-xs font-mono text-mute uppercase tracking-wider px-4 py-3">Timestamp</th>
                <th className="text-left text-xs font-mono text-mute uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-mono text-mute uppercase tracking-wider px-4 py-3">Action</th>
                <th className="text-left text-xs font-mono text-mute uppercase tracking-wider px-4 py-3">Details</th>
                <th className="text-left text-xs font-mono text-mute uppercase tracking-wider px-4 py-3">Document</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-mute">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const profile = getMemberProfile(log.userId);
                  const user = profile || state.users.find(u => u.id === log.userId);
                  const userName = profile?.name || log.userName || 'Unknown User';
                  const userAvatar = profile?.avatar || user?.avatar || userName.slice(0, 2).toUpperCase();
                  const userColor = profile?.color || user?.color || '#888';
                  const Icon = actionIcons[log.action] || Clock;
                  const detailString = formatDetails(log.details);

                  return (
                    <tr key={log.id} className="border-b border-hairline last:border-b-0 hover:bg-canvas-soft2/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs text-mute font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-on-accent text-[8px] font-medium flex-shrink-0"
                            style={{ backgroundColor: userColor }}
                          >
                            {userAvatar}
                          </div>
                          <span className="text-sm text-ink">{userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-mute" />
                          <span className="text-sm text-ink capitalize">{log.action}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-body max-w-xs truncate block" title={detailString}>
                          {detailString || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.documentTitle ? (
                          <span className="text-sm text-link">{log.documentTitle}</span>
                        ) : (
                          <span className="text-sm text-mute">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-mute">{logs.length} entries · Audit logs are retained for 90 days</p>
      </div>
    </div>
  );
}

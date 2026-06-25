import { useApp } from '../context/AppContext';
import { BarChart3, FileSpreadsheet, Users, TrendingUp } from 'lucide-react';

export default function AnalyticsPage() {
  const { state } = useApp();

  // Real aggregated data from workspaces and documents
  const totalWorkspaces = state.workspaces.length;
  const totalDocuments = state.documents.length;
  const totalMembers = state.workspaces.reduce((sum, ws) => sum + ws.members.length, 0);
  const onlineCount = state.onlineUsers.size;

  // Document types breakdown
  const docTypes = state.documents.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Workspace activity - sort by most recently updated
  const workspaceActivity = state.workspaces
    .map(ws => ({
      workspace: ws,
      docCount: state.documents.filter(d => d.workspaceId === ws.id).length,
      memberCount: ws.members.length,
      lastUpdated: new Date(ws.updatedAt).getTime(),
    }))
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
    .slice(0, 5);

  const typeColors: Record<string, string> = {
    budget: '#60a5fa',
    expense: '#f472b6',
    forecast: '#a78bfa',
    report: '#fbbf24',
  };

  const stats = [
    { label: 'Total Workspaces', value: totalWorkspaces, icon: FileSpreadsheet, color: '#60a5fa' },
    { label: 'Total Documents', value: totalDocuments, icon: BarChart3, color: '#a78bfa' },
    { label: 'Team Members', value: totalMembers, icon: Users, color: '#34d399' },
    { label: 'Currently Online', value: onlineCount, icon: TrendingUp, color: '#f472b6' },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink">Financial analytics.</h1>
        <p className="text-sm text-body mt-1">Insights across all workspaces and documents.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-canvas border border-hairline rounded-lg p-5 elev-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-mute font-mono uppercase tracking-wider">{label}</span>
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: color + '22' }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-[-0.96px] text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Document Types */}
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <h2 className="text-base font-semibold tracking-[-0.3px] text-ink mb-1">Documents by type</h2>
          <p className="text-xs text-mute mb-5">Distribution across all workspaces</p>
          {Object.keys(docTypes).length === 0 ? (
            <p className="text-sm text-mute text-center py-8">No documents yet. Create one to see analytics.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(docTypes).map(([type, count]) => {
                const percentage = totalDocuments > 0 ? (count / totalDocuments) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-ink capitalize">{type}</span>
                      <span className="text-xs text-mute font-mono">{count} ({Math.round(percentage)}%)</span>
                    </div>
                    <div className="h-2 bg-canvas-soft2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: typeColors[type] || '#888' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workspace Activity */}
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          <h2 className="text-base font-semibold tracking-[-0.3px] text-ink mb-1">Workspace activity</h2>
          <p className="text-xs text-mute mb-5">Most recently updated</p>
          {workspaceActivity.length === 0 ? (
            <p className="text-sm text-mute text-center py-8">No workspaces yet. Create one to see analytics.</p>
          ) : (
            <div className="space-y-3">
              {workspaceActivity.map(({ workspace, docCount, memberCount }) => (
                <div key={workspace.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{workspace.name}</p>
                    <p className="text-xs text-mute">
                      {docCount} docs · {memberCount} members
                    </p>
                  </div>
                  <span className="text-xs text-mute font-mono flex-shrink-0">
                    {new Date(workspace.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="bg-canvas border border-hairline rounded-lg p-5 text-center elev-card">
        <p className="text-sm text-body">
          <span className="font-medium text-ink">Pro tip:</span> Financial analytics are calculated from your document data in real-time.
          As you create more budgets, forecasts, and expense reports, this dashboard will show deeper insights.
        </p>
      </div>
    </div>
  );
}

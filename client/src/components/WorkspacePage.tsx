import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileSpreadsheet, Plus, Users, Search,
  MoreHorizontal
} from 'lucide-react';
import { CreateDocumentModal } from './forms/WorkspaceForms';

const typeColors: Record<string, string> = {
  budget: '#60a5fa', expense: '#f472b6', forecast: '#a78bfa', report: '#fbbf24'
};
const typeLabels: Record<string, string> = {
  budget: 'Budget', expense: 'Expense', forecast: 'Forecast', report: 'Report'
};

export default function WorkspacePage() {
  const { state, openDocument, getMemberProfile, navigate } = useApp();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreateDoc, setShowCreateDoc] = useState(false);

  const workspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);

  // If a workspace was deleted out from under us (or the URL doesn't match),
  // bounce back to the dashboard rather than dead-ending the user.
  useEffect(() => {
    if (!state.currentWorkspaceId) return;
    if (!workspace && state.workspaces.length > 0) {
      navigate('dashboard');
    }
  }, [workspace, state.currentWorkspaceId, state.workspaces.length, navigate]);

  if (!workspace) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto animate-fadeIn">
        <div className="text-center py-16">
          <p className="text-sm text-mute">Workspace not found. Redirecting…</p>
        </div>
      </div>
    );
  }

  const myWsMembership = workspace.members.find((m) => m.userId === state.user?.id);
  const myWsRole = myWsMembership?.role;
  const canEdit = myWsRole === 'admin' || myWsRole === 'finance_manager';

  const docs = state.documents
    .filter(d => d.workspaceId === workspace.id)
    .filter(d => filter === 'all' || d.type === filter)
    .filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

  const members = workspace.members.map(m => {
    const profile = getMemberProfile(m.userId);
    const user = profile || state.users.find(u => u.id === m.userId);
    const onlineUser = state.onlineUsers.get(m.userId);
    return {
      ...m,
      name: user?.name || onlineUser?.userName || 'Unknown User',
      avatar: user?.avatar || onlineUser?.userAvatar || '??',
      color: user?.color || onlineUser?.userColor || '#888',
    };
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink">{workspace.name}</h1>
          <p className="text-sm text-body mt-1">{workspace.description || 'No description provided.'}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreateDoc(true)}
            className="bg-ink text-on-primary text-sm font-medium px-4 py-2 rounded-full hover:bg-ink/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New document
          </button>
        )}
      </div>

      {/* Members */}
      <div className="bg-canvas border border-hairline rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ink flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team members
          </h3>
          <span className="text-xs text-mute">{members.length} members</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {members.map(member => {
            const isOnline = state.onlineUsers.has(member.userId);
            return (
              <div key={member.userId} className="flex items-center gap-2 bg-canvas-soft2 rounded-full px-3 py-1.5">
                <div className="relative">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-on-accent text-[10px] font-medium"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.avatar}
                  </div>
                  {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-deep border-2 border-canvas" />
                  )}
                </div>
                <span className="text-sm text-ink">{member.name}</span>
                <span className="text-[10px] text-mute font-mono capitalize">{member.role.replace('_', ' ')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center bg-canvas border border-hairline rounded-md px-3 h-9 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-mute mr-2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-ink placeholder:text-mute focus:outline-none w-full"
            placeholder="Search documents..."
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {['all', 'budget', 'expense', 'forecast', 'report'].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors capitalize ${
                filter === t
                  ? 'bg-ink text-on-primary'
                  : 'bg-canvas-soft2 text-body hover:text-ink hover:bg-canvas-soft3'
              }`}
            >
              {t === 'all' ? 'All' : typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Documents grid or empty state */}
      {docs.length === 0 ? (
        <div className="bg-canvas border border-hairline border-dashed rounded-xl p-12 text-center">
          <FileSpreadsheet className="w-10 h-10 text-mute mx-auto mb-3" />
          <h3 className="text-base font-medium text-ink mb-1">
            {search || filter !== 'all' ? 'No documents match your filters' : 'No documents yet'}
          </h3>
          <p className="text-sm text-body mb-4 max-w-md mx-auto">
            {search || filter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Create your first financial document to start collaborating with your team.'}
          </p>
          {!search && filter === 'all' && (
            <button
              onClick={() => setShowCreateDoc(true)}
              className="bg-ink text-on-primary text-sm font-medium px-4 py-2 rounded-full hover:bg-ink/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create your first document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => {
            // Get real active editors from documentEditors map
            const editorIds = state.documentEditors.get(doc.id);
            const activeEditors = editorIds
              ? Array.from(editorIds)
                  .filter(id => id !== state.user?.id)
                  .map(id => state.onlineUsers.get(id))
                  .filter(Boolean)
              : [];

            return (
              <button
                key={doc.id}
                onClick={() => openDocument(doc.id)}
                className="bg-canvas border border-hairline rounded-lg p-5 text-left elev-card elev-card-hover group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: typeColors[doc.type] + '26',
                      color: typeColors[doc.type],
                    }}
                  >
                    {typeLabels[doc.type]}
                  </span>
                  <MoreHorizontal className="w-4 h-4 text-mute opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-sm font-medium text-ink mb-1 truncate">{doc.title}</h3>
                <p className="text-xs text-mute mb-3">
                  {doc.rows.length} rows · Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
                {activeEditors.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {activeEditors.slice(0, 3).map(u => u && (
                        <div
                          key={u.userId}
                          className="w-5 h-5 rounded-full border-2 border-canvas flex items-center justify-center text-on-accent text-[8px] font-medium"
                          style={{ backgroundColor: u.userColor }}
                          title={u.userName}
                        >
                          {u.userAvatar}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-cyan-deep flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-cyan-deep animate-pulse-dot" />
                      Editing live
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Create Document Modal */}
      {showCreateDoc && <CreateDocumentModal onClose={() => setShowCreateDoc(false)} />}
    </div>
  );
}

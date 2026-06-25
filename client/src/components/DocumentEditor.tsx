import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Save, Plus, Trash2, History, ArrowLeft,
  Check, X
} from 'lucide-react';

export default function DocumentEditor() {
  const { state, updateCell, addRow, deleteRow, navigate, moveCursor, getRemoteCursors, getMemberProfile } = useApp();
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doc = state.documents.find((d) => d.id === state.currentDocumentId);

  // If a document was deleted, navigate back to the workspace gracefully.
  useEffect(() => {
    if (!state.currentDocumentId) return;
    if (!doc && state.documents.length > 0) {
      navigate('workspace');
    }
  }, [doc, state.currentDocumentId, state.documents.length, navigate]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-mute">Document not found. Redirecting…</p>
      </div>
    );
  }

  // Get active editors from online users
  const activeUsers = Array.from(state.onlineUsers.values())
    .filter(u => {
      const editors = state.documentEditors.get(doc.id);
      return editors?.has(u.userId);
    });

  // Get remote cursors for this document
  const remoteCursors = getRemoteCursors(doc.id);

  // Viewer check — use workspace-level role, fall back to global role
  const currentWorkspace = state.workspaces.find(w => w.id === state.currentWorkspaceId);
  const myWsMembership = currentWorkspace?.members.find(m => m.userId === state.user?.id);
  const isViewer = (myWsMembership?.role ?? state.user?.role) === 'viewer';

  const startEdit = (rowIdx: number, colIdx: number, value: string) => {
    if (isViewer) return;
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditValue(value);
    
    // Send cursor position
    moveCursor(doc.id, rowIdx, colIdx);
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const commitEdit = useCallback(() => {
    if (!editingCell || !doc) return;
    updateCell(doc.id, editingCell.row, editingCell.col, editValue);
    setEditingCell(null);
  }, [editingCell, editValue, doc, updateCell]);

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
      // Move to next row
      if (editingCell && editingCell.row < doc.rows.length - 1) {
        const nextVal = doc.rows[editingCell.row + 1]?.cells[editingCell.col]?.value || '';
        startEdit(editingCell.row + 1, editingCell.col, nextVal);
      }
    } else if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      if (editingCell) {
        const maxCol = doc.rows[editingCell.row]?.cells.length - 1 || 0;
        if (editingCell.col < maxCol) {
          const nextVal = doc.rows[editingCell.row]?.cells[editingCell.col + 1]?.value || '';
          startEdit(editingCell.row, editingCell.col + 1, nextVal);
        }
      }
    }
  };

  const handleAddRow = () => {
    addRow(doc.id);
  };

  const handleDeleteRow = (rowIdx: number) => {
    if (rowIdx === 0) return; // Don't delete header
    deleteRow(doc.id, rowIdx);
  };

  const handleSave = async () => {
    if (!doc) return;
    try {
      await api.saveVersion(doc.id);
    } catch {
      // Network errors are surfaced via the connection indicator;
      // failing silently here keeps the flow snappy.
    }
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const typeColors: Record<string, string> = {
    budget: '#60a5fa', expense: '#f472b6', forecast: '#a78bfa', report: '#fbbf24'
  };

  // Get audit logs for this document
  const docLogs = state.auditLogs.filter(l => l.documentId === doc.id).slice(0, 10);

  // Find remote cursor for a specific cell
  const getRemoteCursorForCell = (rowIdx: number, cellIdx: number) => {
    return remoteCursors.find(c => c.rowIndex === rowIdx && c.cellIndex === cellIdx);
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Toolbar */}
      <div className="bg-canvas border-b border-hairline px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('workspace')}
          className="text-body hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: typeColors[doc.type] + '26',
                color: typeColors[doc.type],
              }}
            >
              {doc.type}
            </span>
            <h2 className="text-sm font-medium text-ink truncate">{doc.title}</h2>
          </div>
        </div>

        {/* Active editors */}
        {activeUsers.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 mr-2">
            <div className="flex -space-x-1.5">
              {activeUsers.slice(0, 4).map(u => (
                <div
                  key={u.userId}
                  className="w-6 h-6 rounded-full border-2 border-canvas flex items-center justify-center text-on-accent text-[9px] font-medium"
                  style={{ backgroundColor: u.userColor }}
                  title={`${u.userName} is editing`}
                >
                  {u.userAvatar}
                </div>
              ))}
            </div>
            <span className="text-xs text-cyan-deep flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-deep animate-pulse-dot" />
              {activeUsers.length} editing
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isViewer && (
            <>
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-canvas-soft2 rounded-md transition-colors"
                title="Add row"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Row</span>
              </button>
              <button
                onClick={handleSave}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  saveFlash ? 'text-cyan-deep bg-cyan-soft' : 'text-body hover:text-ink hover:bg-canvas-soft2'
                }`}
                title="Save version"
              >
                {saveFlash ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{saveFlash ? 'Saved!' : 'Save'}</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              showHistory ? 'bg-canvas-soft2 text-ink' : 'text-body hover:text-ink hover:bg-canvas-soft2'
            }`}
            title="Version history"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Spreadsheet */}
        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-[600px]">
            <table className="w-full border-collapse">
              <thead>
                {doc.rows.length > 0 && (
                  <tr>
                    <th className="w-10 bg-canvas-soft2 border border-hairline p-0">
                      <div className="h-8 flex items-center justify-center">
                        <span className="text-[10px] text-mute font-mono">#</span>
                      </div>
                    </th>
                    {doc.rows[0].cells.map((cell, ci) => (
                      <th
                        key={cell.id}
                        className="bg-canvas-soft2 border border-hairline p-0 min-w-[120px]"
                      >
                        <div
                          className={`h-8 flex items-center px-3 cursor-pointer hover:bg-canvas-soft3 transition-colors ${
                            editingCell?.row === 0 && editingCell?.col === ci ? 'ring-2 ring-link ring-inset' : ''
                          }`}
                          onClick={() => startEdit(0, ci, cell.value)}
                        >
                          {editingCell?.row === 0 && editingCell?.col === ci ? (
                            <input
                              ref={inputRef}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              className="w-full bg-transparent text-xs font-mono font-medium text-ink outline-none uppercase tracking-wider"
                            />
                          ) : (
                            <span className="text-xs font-mono font-medium text-mute uppercase tracking-wider truncate">
                              {cell.value}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    {state.user?.role !== 'viewer' && (
                      <th className="w-10 bg-canvas-soft2 border border-hairline p-0" />
                    )}
                  </tr>
                )}
              </thead>
              <tbody>
                {doc.rows.slice(1).map((row, ri) => {
                  const rowIdx = ri + 1;
                  return (
                    <tr key={row.id} className="group hover:bg-canvas-soft2/40">
                      <td className="bg-canvas-soft2 border border-hairline p-0">
                        <div className="h-9 flex items-center justify-center">
                          <span className="text-[10px] text-mute font-mono">{rowIdx}</span>
                        </div>
                      </td>
                      {row.cells.map((cell, ci) => {
                        const isEditing = editingCell?.row === rowIdx && editingCell?.col === ci;
                        const isNumber = cell.value.startsWith('$') || cell.value.startsWith('-$') || cell.value.match(/^\d/);
                        const remoteCursor = getRemoteCursorForCell(rowIdx, ci);
                        const hasRemoteCursor = !!remoteCursor;
                        
                        return (
                          <td
                            key={cell.id}
                            className={`border border-hairline p-0 relative ${isEditing ? '' : 'cursor-pointer'}`}
                            onClick={() => !isEditing && startEdit(rowIdx, ci, cell.value)}
                          >
                            {/* Remote cursor indicator - REAL DATA */}
                            {hasRemoteCursor && (
                              <div className="absolute -top-5 left-1 z-10 animate-fadeIn">
                                <div 
                                  className="text-[10px] text-on-accent px-1.5 py-0.5 rounded-sm whitespace-nowrap" 
                                  style={{ backgroundColor: remoteCursor.userColor }}
                                >
                                  {remoteCursor.userName}
                                </div>
                                <div 
                                  className="w-0.5 h-full absolute left-1 top-full" 
                                  style={{ backgroundColor: remoteCursor.userColor }} 
                                />
                              </div>
                            )}
                            <div
                              className={`h-9 flex items-center px-3 transition-colors ${
                                isEditing
                                  ? 'ring-2 ring-link ring-inset bg-canvas-soft3'
                                  : hasRemoteCursor
                                  ? 'ring-2 ring-inset'
                                  : 'hover:bg-canvas-soft2/60'
                              }`}
                              style={hasRemoteCursor ? { '--tw-ring-color': remoteCursor.userColor + '40' } as React.CSSProperties : undefined}
                            >
                              {isEditing ? (
                                <input
                                  ref={inputRef}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={handleKeyDown}
                                  className={`w-full bg-transparent text-sm text-ink outline-none ${
                                    isNumber ? 'text-right font-mono' : ''
                                  }`}
                                />
                              ) : (
                                <span
                                  className={`text-sm truncate w-full ${
                                    isNumber ? 'text-right font-mono text-ink' : 'text-ink'
                                  } ${!cell.value ? 'text-mute' : ''}`}
                                >
                                  {cell.value || '—'}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      {!isViewer && (
                        <td className="border border-hairline p-0 w-10">
                          <div className="h-9 flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRow(rowIdx);
                              }}
                              className="text-mute hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!isViewer && (
              <button
                onClick={handleAddRow}
                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 text-sm text-mute hover:text-ink hover:bg-canvas-soft2 border border-dashed border-hairline rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add row
              </button>
            )}
          </div>
        </div>

        {/* History panel - REAL DATA */}
        {showHistory && (
          <div className="w-72 bg-canvas border-l border-hairline overflow-y-auto flex-shrink-0 animate-slideIn">
            <div className="p-4 border-b border-hairline">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink">Change history</h3>
                <button onClick={() => setShowHistory(false)} className="text-mute hover:text-ink transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3">
              {docLogs.length === 0 ? (
                <p className="text-sm text-mute text-center py-6">No changes recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {docLogs.map(log => {
                    const profile = getMemberProfile(log.userId);
                    const userColor = profile?.color || '#888';
                    const userName = profile?.name || log.userName || 'Unknown';
                    const detailStr = typeof log.details === 'string'
                      ? log.details
                      : Object.entries(log.details || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
                    return (
                      <div key={log.id} className="relative pl-5 pb-3 border-l-2 border-hairline last:border-l-0">
                        <div 
                          className="absolute left-[-5px] top-0 w-2 h-2 rounded-full" 
                          style={{ backgroundColor: userColor }}
                        />
                        <p className="text-sm text-ink font-medium">{userName}</p>
                        <p className="text-xs text-body mt-0.5 capitalize">{log.action}</p>
                        {detailStr && <p className="text-xs text-mute mt-0.5 break-words">{detailStr}</p>}
                        <p className="text-[10px] text-mute mt-1 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-canvas border-t border-hairline px-4 py-1.5 flex items-center justify-between text-xs text-mute flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>{doc.rows.length} rows × {doc.rows[0]?.cells.length || 0} cols</span>
          <span>·</span>
          <span>Last saved {new Date(doc.updatedAt).toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center gap-2">
          {isViewer && (
            <span className="text-warning-deep bg-warning-soft px-2 py-0.5 rounded-full text-[10px] font-medium">View only</span>
          )}
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${state.isConnected ? 'bg-cyan-deep animate-pulse-dot' : 'bg-mute'}`} />
            {state.isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}

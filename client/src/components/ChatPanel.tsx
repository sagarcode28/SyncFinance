import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Send, X } from 'lucide-react';

export default function ChatPanel() {
  const { state, dispatch, sendMessage, startTyping, stopTyping, getTypingUsers, getMemberProfile } = useApp();
  const [message, setMessage] = useState('');
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const wsId = state.currentWorkspaceId;
  const messages = state.chatMessages.filter(m => m.workspaceId === wsId);
  
  // Get REAL typing users from context
  const typingUsers = wsId ? getTypingUsers(wsId) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Handle typing indicator with debounce
  const handleTyping = useCallback(() => {
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      startTyping();
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal(false);
      stopTyping();
    }, 2000);
  }, [isTypingLocal, startTyping, stopTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingLocal) {
        stopTyping();
      }
    };
  }, [isTypingLocal, stopTyping]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    
    // Stop typing indicator
    if (isTypingLocal) {
      setIsTypingLocal(false);
      stopTyping();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    await sendMessage(text);
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (e.target.value.length > 0) {
      handleTyping();
    }
  };

  const workspace = state.workspaces.find(w => w.id === wsId);

  return (
    <div className="w-80 bg-canvas border-l border-hairline flex flex-col flex-shrink-0 animate-slideIn">
      {/* Header */}
      <div className="p-4 border-b border-hairline flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-ink">Chat</h3>
          <p className="text-xs text-mute">{workspace?.name}</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_CHAT_OPEN', payload: false })}
          className="text-mute hover:text-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-mute">No messages yet</p>
            <p className="text-xs text-mute mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.userId === state.user?.id;
            const isSystem = msg.type === 'system';
            
            // Get user info from online users or message

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center py-1">
                  <span className="text-xs text-mute bg-canvas-soft2 px-2 py-0.5 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {!isOwn && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-on-accent text-[9px] font-medium flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getMemberProfile(msg.userId)?.color || (msg as any).userColor || '#60a5fa' }}
                  >
                    {getMemberProfile(msg.userId)?.avatar || (msg as any).userAvatar || '??'}
                  </div>
                )}
                <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                  {!isOwn && (
                    <p className="text-[11px] text-mute mb-0.5">
                      {getMemberProfile(msg.userId)?.name || (msg as any).userName || 'Unknown'}
                    </p>
                  )}
                  <div
                    className={`inline-block px-3 py-2 rounded-xl text-sm ${
                      isOwn
                        ? 'bg-ink text-on-primary rounded-br-sm'
                        : 'bg-canvas-soft2 text-ink rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-mute mt-0.5">
                    {new Date(msg.timestamp || (msg as any).createdAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* REAL Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {typingUsers.slice(0, 3).map(user => (
                <div
                  key={user.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-on-accent text-[9px] font-medium border-2 border-canvas"
                  style={{ backgroundColor: user.color }}
                >
                  {user.avatar}
                </div>
              ))}
            </div>
            <div className="bg-canvas-soft2 rounded-xl px-3 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-mute animate-pulse-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-mute animate-pulse-dot" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-mute animate-pulse-dot" style={{ animationDelay: '400ms' }} />
            </div>
            <span className="text-xs text-mute">
              {typingUsers.length === 1 
                ? `${typingUsers[0].name} is typing...` 
                : `${typingUsers.length} people typing...`}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-hairline">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 h-9 px-3 bg-canvas-soft border border-hairline rounded-lg text-sm text-ink placeholder:text-mute focus:outline-none transition-colors"
            placeholder="Type a message..."
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-9 h-9 flex items-center justify-center bg-ink text-on-primary rounded-lg hover:bg-ink/90 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

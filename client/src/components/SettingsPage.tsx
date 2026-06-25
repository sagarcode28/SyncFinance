import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, Key, Check, AlertCircle, Loader2 } from 'lucide-react';
import Toast, { type ToastType } from './Toast';

type Tab = 'profile' | 'security';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

export default function SettingsPage() {
  const { state, updateProfile, changePassword } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Profile form state
  const [name, setName] = useState(state.user?.name ?? '');
  const [email, setEmail] = useState(state.user?.email ?? '');
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (state.user) {
      setName(state.user.name);
      setEmail(state.user.email);
    }
  }, [state.user]);

  const profileDirty = useMemo(() => {
    if (!state.user) return false;
    return name.trim() !== state.user.name || email.trim().toLowerCase() !== state.user.email.toLowerCase();
  }, [name, email, state.user]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setProfileError('Name must be at least 2 characters.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setProfileError('Please enter a valid email address.');
      return;
    }

    setProfileSubmitting(true);
    const result = await updateProfile({ name: trimmedName, email: trimmedEmail });
    setProfileSubmitting(false);

    if (result.success) {
      showToast('success', 'Profile updated successfully');
    } else {
      setProfileError(result.message || 'Failed to update profile');
      showToast('error', result.message || 'Failed to update profile');
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (!currentPassword) {
      setPwError('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwError('New password must contain uppercase, lowercase, and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from the current one.');
      return;
    }

    setPwSubmitting(true);
    const result = await changePassword({ currentPassword, newPassword });
    setPwSubmitting(false);

    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Password updated successfully');
    } else {
      setPwError(result.message || 'Failed to update password');
      showToast('error', result.message || 'Failed to update password');
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Key },
  ];

  return (
    <div className="p-6 max-w-[1000px] mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink">Settings.</h1>
        <p className="text-sm text-body mt-1">Manage your account and security preferences.</p>
      </div>

      <div className="flex items-center gap-1 mb-8 border-b border-hairline">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-link text-ink font-medium'
                : 'border-transparent text-body hover:text-ink'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSave} className="space-y-6">
          <div className="bg-canvas border border-hairline rounded-lg p-6 elev-card">
            <h3 className="text-base font-semibold tracking-[-0.3px] text-ink mb-4">Personal information</h3>
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-on-accent text-xl font-medium"
                style={{ backgroundColor: state.user?.color || '#60a5fa' }}
              >
                {state.user?.avatar}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{state.user?.name}</p>
                <p className="text-xs text-mute capitalize">{state.user?.role.replace('_', ' ')}</p>
              </div>
            </div>

            {profileError && (
              <div className="bg-error-soft text-error-deep border border-error/20 text-sm px-3 py-2.5 rounded-md mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-name" className="block text-sm font-medium text-ink mb-1.5">Full name</label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-ink focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="settings-email" className="block text-sm font-medium text-ink mb-1.5">Email</label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-ink focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Role</label>
                <input
                  type="text"
                  value={state.user?.role.replace('_', ' ') ?? ''}
                  disabled
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-mute cursor-not-allowed capitalize"
                />
                <p className="text-xs text-mute mt-1">Role changes require an admin.</p>
              </div>
              <div>
                <label htmlFor="settings-timezone" className="block text-sm font-medium text-ink mb-1.5">Timezone</label>
                <select
                  id="settings-timezone"
                  defaultValue="UTC+0"
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-ink focus:outline-none transition-colors"
                >
                  <option value="UTC-8">UTC-8 (Pacific Time)</option>
                  <option value="UTC-5">UTC-5 (Eastern Time)</option>
                  <option value="UTC+0">UTC+0 (GMT)</option>
                  <option value="UTC+1">UTC+1 (CET)</option>
                  <option value="UTC+5:30">UTC+5:30 (IST)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!profileDirty || profileSubmitting}
              className="px-5 py-2 text-sm font-medium rounded-full bg-ink text-on-primary hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {profileSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'security' && (
        <form onSubmit={handlePasswordSave} className="space-y-6">
          <div className="bg-canvas border border-hairline rounded-lg p-6 elev-card">
            <h3 className="text-base font-semibold tracking-[-0.3px] text-ink mb-4">Change password</h3>

            {pwError && (
              <div className="bg-error-soft text-error-deep border border-error/20 text-sm px-3 py-2.5 rounded-md mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            <div className="space-y-4 max-w-md">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-ink mb-1.5">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-ink focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-ink mb-1.5">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-ink focus:outline-none transition-colors"
                />
                {newPassword && (
                  <ul className="text-xs text-mute mt-2 space-y-1">
                    <li className={newPassword.length >= 8 ? 'text-success' : ''}>At least 8 characters</li>
                    <li className={/[A-Z]/.test(newPassword) ? 'text-success' : ''}>One uppercase letter</li>
                    <li className={/[a-z]/.test(newPassword) ? 'text-success' : ''}>One lowercase letter</li>
                    <li className={/[0-9]/.test(newPassword) ? 'text-success' : ''}>One number</li>
                  </ul>
                )}
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-ink mb-1.5">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 bg-canvas-soft border border-hairline rounded-md text-sm text-ink focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSubmitting || !currentPassword || !newPassword || !confirmPassword}
              className="px-5 py-2 text-sm font-medium rounded-full bg-ink text-on-primary hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {pwSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update password'
              )}
            </button>
          </div>
        </form>
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

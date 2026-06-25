import { useApp } from '../context/AppContext';
import { LoginForm, RegisterForm } from './forms/AuthForms';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { navigate } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-canvas-soft">
      {/* Header */}
      <nav className="border-b border-hairline relative z-10 bg-canvas/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('landing')}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center">
              <span className="text-on-primary text-xs font-semibold font-mono">SF</span>
            </div>
            <span className="text-ink font-semibold text-sm tracking-[-0.3px]">SyncFinance</span>
          </button>
          <p className="text-sm text-body">
            {mode === 'login' ? (
              <>
                New here?{' '}
                <button
                  onClick={() => navigate('register')}
                  className="text-link hover:text-link-deep font-medium transition-colors"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => navigate('login')}
                  className="text-link hover:text-link-deep font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </nav>

      {/* Split Screen Content */}
      <div className="flex-1 flex">
        <div
          className="hidden lg:block flex-1 relative overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 animate-gradient"
            style={{
              background:
                'linear-gradient(135deg, #60a5fa 0%, #22d3ee 25%, #a78bfa 50%, #f472b6 75%, #fbbf24 100%)',
            }}
          />
          <div className="absolute inset-0 bg-canvas-soft/40" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold tracking-[-0.96px] text-ink mb-2">
                {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
              </h1>
              <p className="text-sm text-body">
                {mode === 'login'
                  ? 'Sign in to access your financial workspaces.'
                  : 'Start collaborating on financial plans in minutes.'}
              </p>
            </div>

            <div className="bg-canvas border border-hairline rounded-xl p-8 elev-card">
              {mode === 'login' ? <LoginForm /> : <RegisterForm />}
            </div>

            {mode === 'login' && (
              <div className="mt-6 bg-canvas-soft2 border border-hairline rounded-lg p-4">
                <p className="text-xs font-mono text-mute uppercase tracking-wider mb-2">
                  Deployment note
                </p>
                <p className="text-sm text-body">
                  Make sure your backend server is running on{' '}
                  <code className="font-mono text-xs bg-canvas-soft3 text-ink px-1.5 py-0.5 rounded">
                    {((import.meta as any).env?.VITE_API_URL || 'http://localhost:3001')}
                  </code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
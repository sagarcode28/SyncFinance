import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { onboardNewUser } from '../services/onboarding';
import { Loader2, Rocket, FileSpreadsheet, Users, ArrowRight, AlertCircle } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: Props) {
  const { state } = useApp();
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [error, setError] = useState('');

  const handleOnboard = async () => {
    setIsOnboarding(true);
    setError('');

    try {
      const result = await onboardNewUser();

      if (result.error) {
        setError(result.error);
        setIsOnboarding(false);
        return;
      }

      if (result.alreadyOnboarded) {
        onComplete();
        return;
      }

      // Success - navigate to the new workspace
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
      setIsOnboarding(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="min-h-screen bg-canvas-soft flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-link to-violet mb-4 shadow-[0_8px_32px_rgba(96,165,250,0.35)]">
            <Rocket className="w-7 h-7 text-on-accent" />
          </div>
          <h1 className="text-3xl font-semibold tracking-[-1.28px] text-ink mb-3">
            Welcome to SyncFinance, {state.user?.name?.split(' ')[0]}.
          </h1>
          <p className="text-base text-body max-w-lg mx-auto">
            Let's get you set up with a workspace so you can start collaborating on financial plans in real-time.
          </p>
        </div>

        {/* What we'll create */}
        <div className="bg-canvas border border-hairline rounded-xl p-8 mb-6 elev-card">
          <h2 className="text-base font-semibold tracking-[-0.3px] text-ink mb-5">
            Here's what we'll create for you:
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-link-bg-soft flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-4 h-4 text-link" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink mb-1">A "Getting Started" workspace</h3>
                <p className="text-sm text-body">
                  Your first collaborative space. You can invite team members, create documents, and chat.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-violet-soft flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-4 h-4 text-violet-deep" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink mb-1">A testing document</h3>
                <p className="text-sm text-body">
                  An editable spreadsheet with sample data so you can try real-time collaboration features immediately.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-success-soft flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-success" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink mb-1">Full admin access</h3>
                <p className="text-sm text-body">
                  You'll be the workspace owner with full control to manage members, documents, and settings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-error-soft text-error-deep text-sm px-4 py-3 rounded-lg mb-4 flex items-start gap-2 border border-error/20">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Setup failed</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleSkip}
            disabled={isOnboarding}
            className="bg-canvas-soft2 text-ink text-sm font-medium px-5 py-2.5 rounded-full border border-hairline hover:border-hairline-strong hover:bg-canvas-soft3 transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleOnboard}
            disabled={isOnboarding}
            className="bg-ink text-on-primary text-sm font-medium px-5 py-2.5 rounded-full hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isOnboarding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Get started
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-mute text-center mt-6">
          You can always create new workspaces and documents later from the sidebar.
        </p>
      </div>
    </div>
  );
}

import { useApp } from '../context/AppContext';
import {
  ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  const { navigate } = useApp();

  return (
    <div className="min-h-screen bg-canvas-soft">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-canvas-soft/80 backdrop-blur-md border-b border-hairline">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center">
              <span className="text-on-primary text-xs font-semibold font-mono">SF</span>
            </div>
            <span className="text-ink font-semibold text-[15px] tracking-[-0.3px]">SyncFinance</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('login')}
              className="text-sm font-medium text-body hover:text-ink px-3 py-1.5 rounded-md transition-colors"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('register')}
              className="text-sm font-medium bg-ink text-on-primary px-3.5 py-1.5 rounded-md hover:bg-ink/90 transition-colors"
            >
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[900px] h-[600px] opacity-25 blur-[120px] animate-gradient"
            style={{
              background:
                'linear-gradient(135deg, #60a5fa 0%, #22d3ee 25%, #a78bfa 50%, #f472b6 75%, #fbbf24 100%)',
            }}
          />
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-canvas border border-hairline rounded-full px-3 py-1 mb-6">
            <span className="font-mono text-xs text-body">v1.0</span>
            <span className="text-hairline-strong">|</span>
            <span className="text-sm text-body">Real-time financial collaboration</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-[-2.4px] leading-[1] text-ink max-w-4xl mx-auto mb-6">
            Financial planning,
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-gd-develop-start via-gd-preview-start to-gd-preview-end">
              built together.
            </span>
          </h1>
          <p className="text-lg text-body max-w-2xl mx-auto mb-10 leading-7">
            SyncFinance is a real-time collaborative workspace where startups and teams manage
            budgets, track expenses, and build financial plans — simultaneously, without conflicts.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('register')}
              className="bg-ink text-on-primary text-base font-medium px-6 py-3 rounded-full hover:bg-ink/90 transition-colors flex items-center gap-2"
            >
              Get started for free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('login')}
              className="bg-canvas text-ink text-base font-medium px-6 py-3 rounded-full border border-hairline hover:border-hairline-strong transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

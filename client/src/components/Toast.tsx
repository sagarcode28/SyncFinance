import { useEffect, useState } from 'react';
import { Check, AlertTriangle, Info, X as XIcon } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-4 h-4 text-success" />,
  info: <Info className="w-4 h-4 text-link" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  error: <XIcon className="w-4 h-4 text-error" />,
};

const BORDER_CLASSES: Record<ToastType, string> = {
  success: 'border-success/30',
  info: 'border-link/30',
  warning: 'border-warning/30',
  error: 'border-error/30',
};

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const fadeTimer = setTimeout(() => {
      setVisible(false);
      closeTimer = setTimeout(onClose, 200);
    }, duration);
    return () => {
      clearTimeout(fadeTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 bg-canvas border ${BORDER_CLASSES[type]} rounded-lg elev-popover px-4 py-3 flex items-center gap-3 max-w-sm transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {ICONS[type]}
      <p className="text-sm text-ink flex-1">{message}</p>
      <button
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="text-mute hover:text-ink transition-colors"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

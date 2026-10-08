import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const show = useCallback((t: string) => {
    setText(t);
    window.setTimeout(() => setText((cur) => (cur === t ? null : cur)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {text && <div className="rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg">{text}</div>}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

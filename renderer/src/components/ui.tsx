import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'ok' | 'warn' | 'err' | '';
interface ToastState { msg: string; type: ToastType; id: number; }

interface UICtx {
  toast: (msg: string, type?: ToastType) => void;
  showModal: (node: ReactNode) => void;
  closeModal: () => void;
}

const Ctx = createContext<UICtx | null>(null);

export function useUI(): UICtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI mora biti unutar UIProvider');
  return c;
}

const toastBorder: Record<ToastType, string> = {
  ok: 'border-[#245236]', warn: 'border-[#5c4a1e]', err: 'border-[#5e2a2d]', '': 'border-bd2',
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [modal, setModal] = useState<ReactNode>(null);

  const toast = useCallback((msg: string, type: ToastType = '') => {
    const id = Date.now();
    setToastState({ msg, type, id });
    setTimeout(() => setToastState((s) => (s && s.id === id ? null : s)), 3200);
  }, []);

  const showModal = useCallback((node: ReactNode) => setModal(node), []);
  const closeModal = useCallback(() => setModal(null), []);

  return (
    <Ctx.Provider value={{ toast, showModal, closeModal }}>
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-[min(560px,92vw)] max-h-[88vh] overflow-auto bg-panel border border-bd2 rounded-2xl shadow-2xl">
            {modal}
          </div>
        </div>
      )}
      {toastState && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-panel3 border ${toastBorder[toastState.type]} px-5 py-3 rounded-xl text-sm shadow-2xl max-w-lg`}>
          {toastState.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

// --- pomoćne komponente za modale ---
export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="px-5 py-4 border-b border-bd flex items-center justify-between">
      <h3 className="text-lg font-semibold m-0">{title}</h3>
      <button className="btn btn-ghost" onClick={onClose}>✕</button>
    </div>
  );
}
export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="px-5 py-4 flex flex-col gap-3.5">{children}</div>;
}
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="px-5 py-3.5 border-t border-bd flex justify-end gap-2">{children}</div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field flex flex-col gap-1.5">
      <label>{label}</label>
      {children}
    </div>
  );
}

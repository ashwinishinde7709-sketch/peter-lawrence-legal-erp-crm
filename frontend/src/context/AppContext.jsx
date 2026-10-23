import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { roles } from '../utils/data';
import { placeholderService } from '../services/placeholderService';
const AuthContext = createContext(null); const ToastContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('pl-user')) || null; } catch { return null; } });
  const login = useCallback(async (email, password, role = 'admin') => { const result = await placeholderService.login({ email, password, role }); const next = result?.data?.user; const token = result?.data?.token; if (!next || !token) throw new Error('Login response was incomplete'); localStorage.setItem('pl-user', JSON.stringify(next)); localStorage.setItem('pl-token', token); setUser(next); return next; }, []);
  const logout = useCallback(() => { localStorage.removeItem('pl-user'); localStorage.removeItem('pl-token'); setUser(null); }, []);
  const value = useMemo(() => ({ user, login, logout, loading: false, roles }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export function ToastProvider({ children }) { const [toasts, setToasts] = useState([]); const pushToast = useCallback((message, tone = 'success') => { const id = `${Date.now()}-${Math.random()}`; setToasts((items) => [...items, { id, message, tone }]); window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600); }, []); const dismissToast = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []); const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast]); return <ToastContext.Provider value={value}>{children}<ToastViewport toasts={toasts} onDismiss={dismissToast} /></ToastContext.Provider>; }
export const useToast = () => useContext(ToastContext);
function ToastViewport({ toasts, onDismiss }) { return <div className="toast-viewport" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast-card toast-${toast.tone}`} role="status"><span className="toast-dot" /><span>{toast.message}</span><button onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">×</button></div>)}</div>; }

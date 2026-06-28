import { Navigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';

// Defense-in-depth client guard: only render the admin shell when the stored token is a
// structurally-valid, non-expired JWT. The API still re-verifies every call server-side
// (signature/exp) — this just stops the shell flashing for a garbage/expired session (CD-7).
function hasValidSession(token: string | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = parts[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };
    if (typeof exp !== 'number') return false;
    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  return hasValidSession(token) ? <>{children}</> : <Navigate to="/admin/login" replace />;
}

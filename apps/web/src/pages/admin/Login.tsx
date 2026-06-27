import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { useAuth } from '../../store/auth';

export default function Login() {
  const nav = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await adminApi.login(email, password);
      setSession(r.token, r.email);
      nav('/admin');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-[360px] bg-card border border-line rounded-[6px] p-7 flex flex-col gap-4"
      >
        <div className="font-display font-extrabold text-[22px] tracking-[0.2em] uppercase text-center">
          Resolute<span className="text-red">·</span>Admin
        </div>
        {err && (
          <div className="text-red text-[13px] font-display uppercase tracking-[0.06em]">{err}</div>
        )}
        <input
          className="bg-bg border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] outline-none focus:border-gold"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="bg-bg border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] outline-none focus:border-gold"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          disabled={busy}
          className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60"
        >
          Ingresar
        </button>
      </form>
    </main>
  );
}

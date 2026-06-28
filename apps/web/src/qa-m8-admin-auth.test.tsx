// QA Módulo 8 — Admin authentication, capa web (docs/qa/08-admin-auth.md).
// Cubre TC-AUTH-023..031: persistencia de sesión (Zustand persist), ProtectedRoute,
// auto-logout en 401 (adminApi), CD-7, logout "Salir", login submit, y a11y del form.
// Usa el adminApi REAL con fetch stubeado (jsdom) → comportamiento de cliente fiel.
// Archivo de corrida QA, no set permanente.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Sólo interceptamos useNavigate para aseverar la navegación; el resto de react-router-dom es real.
const { navMock } = vi.hoisted(() => ({ navMock: vi.fn() }));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navMock };
});

import { useAuth } from './store/auth';
import { adminApi } from './lib/adminApi';
import ProtectedRoute from './components/admin/ProtectedRoute';
import Login from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';

const ok = (body: unknown) => ({ status: 200, ok: true, json: async () => body });
const unauthorized = () => ({ status: 401, ok: false, json: async () => ({ error: 'Credenciales inválidas' }) });

beforeEach(() => {
  navMock.mockReset();
  localStorage.clear();
  useAuth.setState({ token: null, email: null });
  vi.stubGlobal('fetch', vi.fn());
});

// helper: monta /admin protegido + /admin/login para ver a dónde resuelve ProtectedRoute
function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<ProtectedRoute><div>ADMIN_SHELL</div></ProtectedRoute>} />
        <Route path="/admin/login" element={<div>LOGIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ───────────────────────── Persistencia de sesión ─────────────────────────
describe('Sesión — persistencia', () => {
  it('TC-AUTH-023a: setSession persiste {token,email} en localStorage["rf-admin"]', () => {
    useAuth.getState().setSession('tok-123', 'admin@test.com');
    const raw = localStorage.getItem('rf-admin');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.token).toBe('tok-123');
    expect(parsed.state.email).toBe('admin@test.com');
  });

  it('TC-AUTH-023b: una store nueva rehidrata la sesión desde localStorage (reload)', async () => {
    localStorage.setItem('rf-admin', JSON.stringify({ state: { token: 'tok-xyz', email: 'admin@test.com' }, version: 0 }));
    vi.resetModules();
    const { useAuth: fresh } = await import('./store/auth');
    expect(fresh.getState().token).toBe('tok-xyz');
    expect(fresh.getState().email).toBe('admin@test.com');
  });
});

// ───────────────────────── ProtectedRoute & CD-7 ─────────────────────────
describe('ProtectedRoute', () => {
  it('TC-AUTH-024: sin token redirige a /admin/login (no renderiza el shell)', () => {
    renderProtected();
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN_SHELL')).not.toBeInTheDocument();
  });

  it('TC-AUTH-026: CD-7 corregido — token truthy pero inválido NO renderiza el shell (redirige a login)', () => {
    useAuth.setState({ token: 'garbage-invalid-token', email: 'x' });
    renderProtected();
    // FIX CD-7/H-04: ProtectedRoute ahora valida estructura/exp del JWT → un token inválido redirige.
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN_SHELL')).not.toBeInTheDocument();
  });

  it('TC-AUTH-026b: token JWT válido y no expirado SÍ renderiza el shell', () => {
    // JWT real con exp ~12h en el futuro (firmado con clave dummy — sólo se decodifica el payload).
    const future = Math.floor(Date.now() / 1000) + 43200;
    const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'admin-id', email: 'admin@test.com', exp: future })}.sig`;
    useAuth.setState({ token: jwt, email: 'admin@test.com' });
    renderProtected();
    expect(screen.getByText('ADMIN_SHELL')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_PAGE')).not.toBeInTheDocument();
  });
});

// ───────────────────────── Auto-logout en 401 ─────────────────────────
describe('adminApi — auto-logout en 401', () => {
  it('TC-AUTH-025: cualquier 401 → logout() y throw "Sesión expirada"', async () => {
    useAuth.setState({ token: 'tok', email: 'admin@test.com' });
    vi.mocked(fetch).mockResolvedValue(unauthorized() as any);
    await expect(adminApi.products()).rejects.toThrow('Sesión expirada');
    expect(useAuth.getState().token).toBeNull();
    expect(useAuth.getState().email).toBeNull();
  });
});

// ───────────────────────── Logout "Salir" ─────────────────────────
describe('Logout', () => {
  it('TC-AUTH-027: "Salir" limpia la sesión y navega a /admin/login', () => {
    useAuth.setState({ token: 'tok', email: 'admin@test.com' });
    render(<MemoryRouter><AdminLayout /></MemoryRouter>);
    fireEvent.click(screen.getByText('Salir'));
    expect(useAuth.getState().token).toBeNull();
    expect(useAuth.getState().email).toBeNull();
    expect(navMock).toHaveBeenCalledWith('/admin/login');
  });
});

// ───────────────────────── Login submit ─────────────────────────
describe('Login — submit', () => {
  it('TC-AUTH-028: login OK → setSession persiste y navega a /admin; botón se deshabilita durante la request', async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ token: 'new-tok', email: 'admin@test.com' }) as any);
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    // durante la request el botón queda disabled (busy)
    expect((screen.getByRole('button', { name: 'Ingresar' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(navMock).toHaveBeenCalledWith('/admin'));
    expect(useAuth.getState().token).toBe('new-tok');
    expect(useAuth.getState().email).toBe('admin@test.com');
  });
});

// ───────────────────────── Accesibilidad & errores del form ─────────────────────────
describe('Login — a11y & errores', () => {
  it('TC-AUTH-029: labels, tipos, autocomplete y botón Ingresar', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    const email = screen.getByLabelText('Email') as HTMLInputElement;
    const pass = screen.getByLabelText('Contraseña') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.autocomplete).toBe('username');
    expect(pass.type).toBe('password');
    expect(pass.autocomplete).toBe('current-password');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('TC-AUTH-030: el campo password está enmascarado (type=password)', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).type).toBe('password');
  });

  it('TC-AUTH-031: error en fallo y se limpia en reintento; muestra "Credenciales inválidas" (H-03 corregido)', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'bad' } });

    // 1er intento: API 401 {Credenciales inválidas} → login propaga el error real (no auto-logout)
    vi.mocked(fetch).mockResolvedValue(unauthorized() as any);
    fireEvent.submit(screen.getByRole('button', { name: 'Ingresar' }).closest('form')!);
    await waitFor(() => expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument());
    // FIX H-03: ya NO muestra el engañoso "Sesión expirada" ante credenciales incorrectas
    expect(screen.queryByText('Sesión expirada')).not.toBeInTheDocument();

    // 2do intento exitoso: setErr(null) al inicio limpia el error previo
    vi.mocked(fetch).mockResolvedValue(ok({ token: 't', email: 'admin@test.com' }) as any);
    fireEvent.submit(screen.getByRole('button', { name: 'Ingresar' }).closest('form')!);
    await waitFor(() => expect(screen.queryByText('Credenciales inválidas')).not.toBeInTheDocument());
  });
});

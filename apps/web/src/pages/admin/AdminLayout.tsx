import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';

const link = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-3 font-display font-semibold tracking-[0.1em] uppercase text-[14px] rounded-[2px] ${
    isActive ? 'bg-red text-white' : 'text-mut hover:text-tx'
  }`;

export default function AdminLayout() {
  const nav = useNavigate();
  const logout = useAuth((s) => s.logout);
  return (
    <div className="min-h-screen bg-bg text-tx font-body flex">
      <aside className="w-[230px] border-r border-line p-4 flex flex-col gap-1 sticky top-0 h-screen">
        <div className="font-display font-extrabold text-[18px] tracking-[0.2em] uppercase px-2 py-4">
          Resolute<span className="text-red">·</span>Admin
        </div>
        <NavLink to="/admin" end className={link}>
          Métricas
        </NavLink>
        <NavLink to="/admin/productos" className={link}>
          Productos
        </NavLink>
        <NavLink to="/admin/pedidos" className={link}>
          Pedidos
        </NavLink>
        <NavLink to="/admin/correo" className={link}>
          Correo
        </NavLink>
        <NavLink to="/admin/drop" className={link}>
          Drop
        </NavLink>
        <NavLink to="/admin/contenido" className={link}>
          Contenido
        </NavLink>
        <button
          onClick={() => {
            logout();
            nav('/admin/login');
          }}
          className="mt-auto text-left px-4 py-3 font-display font-semibold tracking-[0.1em] uppercase text-[14px] text-mut hover:text-red"
        >
          Salir
        </button>
      </aside>
      <main className="flex-1 p-6 md:p-10 max-w-[1100px]">
        <Outlet />
      </main>
    </div>
  );
}

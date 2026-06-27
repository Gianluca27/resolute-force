import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';
import type { AdminProductDTO } from '@resolute/shared';

export default function AdminProducts() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-products'], queryFn: adminApi.products });
  const del = useMutation({ mutationFn: (id: string) => adminApi.deleteProduct(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }) });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-black text-[34px] uppercase">Productos</h1>
        <Link to="/admin/productos/nuevo" className="bg-red text-white no-underline font-display font-bold text-[14px] tracking-[0.12em] uppercase px-5 py-3 rounded-[2px] hover:bg-redd">+ Nuevo</Link>
      </div>
      <div className="flex flex-col gap-2">
        {(data ?? []).map((p: AdminProductDTO) => (
          <div key={p.id} className="flex items-center gap-4 bg-card border border-line rounded-[4px] p-3">
            <img src={p.imageUrl} alt="" className="w-14 h-14 object-cover rounded-[3px] bg-[#d2d2cf]" />
            <div className="flex-1">
              <div className="font-display font-bold uppercase tracking-[0.04em]">{p.line} · {p.color}</div>
              <div className="text-mut text-[13px]">{money(p.price)} · {p.sizes.map((s) => `${s.size}:${s.stock}`).join('  ')} · {p.active ? 'activo' : 'inactivo'}</div>
            </div>
            <Link to={`/admin/productos/${p.id}`} className="text-gold no-underline font-display uppercase text-[13px] tracking-[0.1em]">Editar</Link>
            <button onClick={() => confirm('¿Borrar producto?') && del.mutate(p.id)} className="text-mut hover:text-red font-display uppercase text-[13px] tracking-[0.1em] bg-transparent border-0 cursor-pointer">Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

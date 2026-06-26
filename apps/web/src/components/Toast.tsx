import { useToast } from '../store/toast';

export default function Toast() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div key={message} className="fixed left-1/2 bottom-[30px] z-[600] -translate-x-1/2 bg-tx text-bg font-display font-bold text-[14.5px] tracking-[0.06em] uppercase px-[22px] py-[14px] rounded-[3px] shadow-[0_14px_34px_-12px_rgba(0,0,0,0.7)] animate-toast flex items-center gap-[10px] max-w-[90vw]">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#e4322b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
      {message}
    </div>
  );
}

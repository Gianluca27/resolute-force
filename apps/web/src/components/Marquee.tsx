export default function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="bg-red text-white overflow-hidden whitespace-nowrap border-b border-black/25 relative z-40">
      <div className="inline-flex items-center animate-marquee will-change-transform py-[9px] font-display font-bold text-[13px] tracking-[0.22em] uppercase">
        {loop.map((t, i) => (
          <span key={i} className="inline-flex items-center">
            <span className="px-[26px]">{t}</span>
            <span className="opacity-[0.55]">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

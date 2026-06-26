function Principle({ n, title, sub, color }: { n: string; title: string; sub: string; color: string }) {
  return (
    <div className="flex items-baseline gap-[18px] py-[18px] border-t border-line">
      <span className="font-display font-extrabold text-[15px] tracking-[0.1em] w-[34px] shrink-0" style={{ color }}>{n}</span>
      <div>
        <div className="font-display font-bold text-[22px] tracking-[0.04em] uppercase">{title}</div>
        <div className="text-mut text-[15px] mt-[2px]">{sub}</div>
      </div>
    </div>
  );
}

export default function Manifiesto() {
  return (
    <section id="manifiesto" data-screen-label="Manifiesto" className="scroll-mt-20 bg-panel border-y border-line px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)]">
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className="flex-1 basis-[360px] min-w-[300px] relative">
          <div className="pointer-events-none absolute -inset-[10px] blur-[8px]" style={{ background: 'radial-gradient(circle at 50% 40%,rgba(228,50,43,.18),transparent 70%)' }} />
          <div className="relative border border-line2 rounded-[3px] overflow-hidden bg-black">
            <img src="/assets/teaser-burst.png" alt="Atleta Resolute Force rompiendo el papel" className="block w-full h-auto" />
            <div className="absolute left-4 top-4 bg-[rgba(10,10,11,0.7)] backdrop-blur-[6px] border border-line2 text-gold font-display font-bold text-[12px] tracking-[0.2em] uppercase px-3 py-[7px] rounded-[2px]">Champions think under pressure</div>
          </div>
        </div>
        <div className="flex-1 basis-[420px] min-w-[300px]">
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">El Manifiesto</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.4rem,5.4vw,4.4rem)]">La presión no te quiebra.<br /><span className="text-red">Te forja.</span></h2>
          <p className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">Cada prenda lleva un recordatorio en la espalda: lo que te define no es el talento, es la mentalidad. Disciplina cuando nadie mira. Constancia cuando todo cuesta. <span className="text-tx font-semibold">Ser campeón se decide mucho antes de competir.</span></p>
          <div className="flex flex-col mt-9">
            <Principle n="01" title="Champions think under pressure" sub="La mente decide antes que el cuerpo." color="#e4322b" />
            <Principle n="02" title="Discipline is the key" sub="La constancia construye lo que la motivación promete." color="#e8b53e" />
            <div className="border-b border-line"><Principle n="03" title="Stop at nothing" sub="No hay plan B para los que van por todo." color="#f4f4f3" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

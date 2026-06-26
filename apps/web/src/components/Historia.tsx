function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 basis-[120px] border border-line rounded-[3px] px-5 py-[18px] bg-bg">
      <div className="font-display font-black text-[34px] leading-none" style={{ color }}>{value}</div>
      <div className="text-mut text-[13px] font-display tracking-[0.14em] uppercase mt-[6px]">{label}</div>
    </div>
  );
}

export default function Historia() {
  return (
    <section id="historia" data-screen-label="Historia" className="scroll-mt-20 bg-panel border-y border-line px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)]">
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className="flex-1 basis-[400px] min-w-[300px] order-2">
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">Sobre la marca</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.3rem,5vw,4rem)]">Nacida en el gimnasio,<br />forjada en la disciplina</h2>
          <p className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">Resolute Force nació en 2024 entre pesas, madrugadas y la convicción de que la ropa con la que entrenás debería recordarte quién querés ser. Empezamos imprimiendo unas pocas remeras para amigos del gym. Hoy somos una comunidad de atletas que comparten una misma norma: <span className="text-tx font-semibold">no rendirse nunca.</span></p>
          <div className="flex flex-wrap gap-[14px] mt-[34px]">
            <Stat value="2024" label="Año de fundación" color="#e4322b" />
            <Stat value="+5.000" label="Atletas en el ejército" color="#e8b53e" />
            <Stat value="100%" label="Algodón premium" color="#f4f4f3" />
          </div>
        </div>
        <div className="flex-1 basis-[360px] min-w-[300px] order-1">
          <div className="border border-line2 rounded-[3px] overflow-hidden relative">
            <img src="/assets/lifestyle-gym.png" alt="Colección Resolute Force en el gimnasio" className="block w-full h-auto" />
            <div className="absolute inset-x-0 bottom-0 px-5 pt-[34px] pb-[18px]" style={{ background: 'linear-gradient(transparent,rgba(10,10,11,.92))' }}>
              <div className="font-display font-extrabold text-[20px] tracking-[0.06em] uppercase text-white">The Resolute Standard</div>
              <div className="text-mut text-[14px]">Donde la presión se convierte en carácter.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

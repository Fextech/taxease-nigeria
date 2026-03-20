export default function BackgroundLayer() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-50] overflow-hidden bg-[#0b0f0d]">
      
      {/* ── glow orbs ── */}
      <div 
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 600, height: 600, background: '#00e87a',
          top: -200, left: -150,
          filter: 'blur(110px)', opacity: 0.18, zIndex: -40
        }}
      />
      <div 
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 500, height: 500, background: '#f5d000',
          bottom: -180, right: -120,
          filter: 'blur(110px)', opacity: 0.18, zIndex: -40
        }}
      />
      <div 
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 350, height: 350, background: '#00c9b1',
          top: '40%', right: '10%',
          filter: 'blur(110px)', opacity: 0.18, zIndex: -40
        }}
      />

      {/* ── grid lines ── */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          zIndex: -30
        }}
      />

      {/* ── noise overlay ── */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          zIndex: -20
        }}
      />
    </div>
  );
}

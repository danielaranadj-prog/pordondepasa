import React, { useState } from 'react';
import '../styles/glass.css';
import '../styles/home.css';
import '../styles/sheet.css';
import '../styles/navigation.css';

export default function AdsDemo() {
  const [expanded, setExpanded] = useState(true);

  return (
    <main className="glass-app trip-screen" style={{ height: '100dvh', background: '#e0e0e0', position: 'relative', overflow: 'hidden' }}>
      
      {/* Fake Map Background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(#c2c2c2 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="none">
           <path d="M50,150 C150,250 250,450 150,600" fill="none" stroke="var(--route-bus, #333)" strokeWidth="6" strokeLinecap="round" strokeDasharray="10 10"/>
           <circle cx="50" cy="150" r="12" fill="white" stroke="var(--route-bus, #333)" strokeWidth="4"/>
           <circle cx="150" cy="600" r="12" fill="white" stroke="var(--glass-blue, blue)" strokeWidth="4"/>
           {/* Patrocinador Pin */}
           <g transform="translate(180, 350)">
             <path d="M0,0 C-12,-12 -12,-30 0,-42 C12,-54 30,-54 42,-42 C54,-30 54,-12 42,0 L21,24 Z" fill="#D4AF37"/>
             <text x="21" y="-15" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">☕</text>
             <rect x="-30" y="-80" width="100" height="26" rx="13" fill="white" stroke="#D4AF37" strokeWidth="2" />
             <text x="20" y="-62" textAnchor="middle" fill="#8B6914" fontSize="11" fontWeight="bold" fontFamily="system-ui">Café de Olla</text>
           </g>
        </svg>
      </div>

      <div className="map-top map-top-minimal">
        <button className="back-button" onClick={() => window.history.back()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      </div>

      <section className={`ui-panel map-sheet ${expanded ? 'sheet-expanded' : 'sheet-closed'}`}>
        <button className="sheet-handle" onClick={() => setExpanded(!expanded)}>
          <span className="sheet-grip"></span>
          <span></span>
          <span style={{textAlign: 'center', flex: 1}}>Ruta sugerida</span>
          <span className="sheet-chevron" style={{transform: expanded ? 'rotate(180deg)' : 'none'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </button>

        <div className="sheet-content" hidden={!expanded}>
          
          <div className="route-slide" style={{ padding: '0 20px' }}>
            <div className="time" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 }}>
              <div>
                <strong style={{ fontSize: 32, display: 'block', lineHeight: 1 }}>14 <small style={{fontSize: 16, color: 'var(--ui-muted)'}}>min</small></strong>
                <span style={{ fontSize: 13, color: 'var(--ui-muted)' }}>Llega aprox a las 12:45 PM</span>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--glass-blue)' }}>
                $14.00 MXN
              </div>
            </div>

            <div className="legs" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
               <span className="leg leg-bus" style={{ background: '#2d6e5d', color: '#fff', padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 'bold' }}>
                 Progreso 5
               </span>
               <span className="leg leg-walk" style={{ display: 'flex', alignItems: 'center', color: 'var(--ui-muted)' }}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6M9 11l3 5 3-5M12 5v6"/></svg>
                 <small>5 min</small>
               </span>
            </div>

            {/* AD BANNER NATIVO */}
            <div style={{ background: 'var(--glass-soft)', border: '1px solid var(--ui-line)', borderRadius: 16, padding: 12, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
               <span style={{ position: 'absolute', top: 0, right: 0, background: '#eab308', color: '#fff', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderBottomLeftRadius: 8 }}>Patrocinado</span>
               <div style={{ width: 44, height: 44, background: '#fff', borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 24, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                 🍔
               </div>
               <div style={{ flex: 1 }}>
                 <strong style={{ display: 'block', fontSize: 14, color: 'var(--ui-text)', marginBottom: 2 }}>Carl's Jr. - ¡2x1 HOY!</strong>
                 <p style={{ margin: 0, fontSize: 11, color: 'var(--ui-muted)', lineHeight: 1.3 }}>Bájate en la parada "Fórum" y muestra tu ruta en la app para un combo doble.</p>
               </div>
            </div>

            <details className="journey-details" open style={{ marginBottom: 24 }}>
              <summary style={{ fontWeight: 650, padding: '12px 0', borderTop: '1px solid var(--ui-line)', borderBottom: '1px solid var(--ui-line)', cursor: 'pointer' }}>
                Ver paradas (12 paradas)
              </summary>
              <div style={{ padding: '20px 10px', display: 'grid', gap: 20 }}>
                 
                 <div style={{ display: 'flex', gap: 15, position: 'relative' }}>
                   <div style={{ position: 'absolute', left: 5, top: 20, bottom: -20, width: 2, background: '#2d6e5d' }}></div>
                   <div style={{ width: 12, height: 12, background: '#fff', border: '3px solid #2d6e5d', borderRadius: '50%', zIndex: 2, marginTop: 4 }}></div>
                   <div>
                     <strong style={{ display: 'block', fontSize: 14 }}>Sube en Av. Insurgentes</strong>
                     <span style={{ fontSize: 12, color: 'var(--ui-muted)' }}>12:31 PM</span>
                   </div>
                 </div>

                 {/* AD PARADA PATROCINADA */}
                 <div style={{ display: 'flex', gap: 15, position: 'relative', background: 'rgba(212, 175, 55, 0.08)', margin: '-10px -20px -10px -10px', padding: '10px 20px 10px 10px', borderRadius: 12, border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                   <div style={{ position: 'absolute', left: 15, top: 20, bottom: -20, width: 2, background: '#2d6e5d' }}></div>
                   <div style={{ width: 14, height: 14, background: '#fff', border: '4px solid #D4AF37', borderRadius: '50%', zIndex: 2, marginTop: 2, boxShadow: '0 0 0 4px rgba(212,175,55,0.1)' }}></div>
                   <div style={{ flex: 1 }}>
                     <strong style={{ display: 'block', fontSize: 14, color: '#997a00' }}>📍 Café de Olla</strong>
                     <span style={{ fontSize: 12, color: 'var(--ui-muted)' }}>A 1 cuadra de tu trayecto. Desayunos desde $89.</span>
                   </div>
                 </div>

                 <div style={{ display: 'flex', gap: 15, position: 'relative' }}>
                   <div style={{ width: 12, height: 12, background: '#fff', border: '3px solid #000', borderRadius: '50%', zIndex: 2, marginTop: 4 }}></div>
                   <div>
                     <strong style={{ display: 'block', fontSize: 14 }}>Baja en Plaza Forum</strong>
                     <span style={{ fontSize: 12, color: 'var(--ui-muted)' }}>12:45 PM</span>
                   </div>
                 </div>

              </div>
            </details>

          </div>
        </div>
      </section>
    </main>
  );
}

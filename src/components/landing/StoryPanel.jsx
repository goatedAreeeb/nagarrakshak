import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function StoryPanel({ onSectionChange }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const sections = containerRef.current.querySelectorAll('.sys-chapter');
      const scrollPosition = containerRef.current.scrollTop + window.innerHeight / 3;
      
      let currentSection = 0;
      sections.forEach((section, index) => {
        const top = section.offsetTop;
        if (scrollPosition >= top) {
          currentSection = index;
        }
      });
      onSectionChange(currentSection);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [onSectionChange]);

  return (
    <div 
      ref={containerRef}
      className="relative z-20 h-full w-full overflow-y-auto scroll-smooth bg-transparent text-slate-300"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="max-w-3xl mx-auto px-12 py-32 pb-96 space-y-64">
        
        {/* HERO SECTION */}
        <div className="min-h-[80vh] flex flex-col justify-center sys-chapter relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="landing-mono landing-kicker mb-12 max-w-2xl space-y-4">
              <p>Every year, thousands of complaints disappear into silence.</p>
              <p>Every day, our infrastructure decays without accountability.</p>
              <p className="landing-kicker-strong !text-xl md:!text-2xl">It ends now.</p>
            </div>

            <h1 className="landing-display mb-12 text-7xl font-extrabold uppercase leading-[0.85] tracking-tight md:text-8xl lg:text-9xl">
              <span className="block overflow-hidden">
                <motion.span
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="landing-hero-outline block"
                >
                  Your City.
                </motion.span>
              </span>
              <span className="block overflow-hidden">
                <motion.span
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="landing-hero-fill block"
                >
                  Your Voice.
                </motion.span>
              </span>
            </h1>

            <p className="max-w-2xl text-xl font-light leading-relaxed text-slate-400 md:text-2xl">
              Nagar Rakshak is a transparent, real-time command center for urban accountability. We turn citizen complaints into tracked, public data that the system can no longer ignore.
            </p>
          </motion.div>
        </div>

        {/* SECTION 1: THE CRISIS */}
        <div className="sys-chapter relative">
          <div className="sticky top-24 z-10 bg-lp-background/90 backdrop-blur pb-8 border-b border-lp-border mb-16">
            <h2 className="text-4xl font-black font-sans text-white tracking-widest uppercase">
              <span className="text-lp-red">01 //</span> THE CRISIS
            </h2>
          </div>

          <div className="space-y-48">
            {/* Case 1: Flooding */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, margin: "-20%" }}
              className="relative"
            >
              <div className="absolute -left-12 top-0 h-full w-px bg-lp-border">
                <div className="w-full h-1/3 mt-12 w-full bg-lp-red shadow-glow-red" />
              </div>
              <p className="font-mono text-xs text-lp-red mb-4 tracking-widest uppercase">Tolichowki, Hyderabad</p>
              <h3 className="text-3xl text-white font-bold mb-4">The Silence of the Sewers</h3>
              <p className="text-gray-400 text-lg mb-8 max-w-md leading-relaxed">
                When the rains hit, the drains fail. Citizens report flooding every monsoon, but the tickets stay "pending" for months. In Tolichowki, infrastructure neglect isn't just an inconvenience—it's a recurring crisis.
              </p>
              
              <div className="landing-image-frame group relative w-fit p-2">
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-lp-red" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-lp-red" />
                <img src="/images/flooded_street.png" alt="Flooded Street" className="h-[300px] w-full max-w-[500px] object-cover saturate-[0.85] transition-all duration-700 group-hover:saturate-100 md:w-[500px]" />
                <div className="absolute bottom-4 left-4 font-mono text-[9px] bg-lp-background/80 px-2 py-1 text-lp-red">REPORT FILED: 180 DAYS AGO</div>
              </div>
            </motion.div>

            {/* Case 2: Potholes */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, margin: "-20%" }}
              className="relative"
            >
              <div className="absolute -left-12 top-0 h-full w-px bg-lp-border">
                <div className="mt-12 h-1/3 w-full bg-lp-amber shadow-glow-amber" />
              </div>
              <p className="font-mono text-xs text-lp-amber mb-4 tracking-widest uppercase">Miyapur, Hyderabad</p>
              <h3 className="text-3xl text-white font-bold mb-4">The Pothole Epidemic</h3>
              <p className="text-gray-400 text-lg mb-8 max-w-md leading-relaxed">
                Every commute is a gamble. Pothole density on main arterial roads has reached critical levels, leading to accidents and vehicle damage. Contractors get paid, but the roads remain broken.
              </p>
              
              <div className="landing-image-frame group relative w-fit p-2">
                <div className="absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-lp-amber" />
                <div className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-lp-amber" />
                <img src="/images/pothole_road.png" alt="Pothole Road" className="h-[300px] w-full max-w-[500px] object-cover saturate-[0.85] transition-all duration-700 group-hover:saturate-100 md:w-[500px]" />
                <div className="absolute bottom-4 left-4 font-mono text-[9px] bg-lp-background/80 px-2 py-1 text-lp-amber">STATUS: NEEDS URGENT REPAIR</div>
              </div>
            </motion.div>

            {/* Case 3: Streetlights */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, margin: "-20%" }}
              className="relative"
            >
              <div className="absolute -left-12 top-0 h-full w-px bg-lp-border" />
              <p className="font-mono text-xs text-gray-500 mb-4 tracking-widest uppercase">Secunderabad, Hyderabad</p>
              <h3 className="text-3xl text-white font-bold mb-4">Streets in the Dark</h3>
              <p className="text-gray-400 text-lg mb-8 max-w-md leading-relaxed">
                Broken streetlights make entire neighborhoods feel unsafe after sunset. Despite multiple complaints, legacy systems fail to track the repair status, leaving women and the elderly in the dark.
              </p>
              
              <div className="landing-image-frame group relative w-fit p-2">
                <div className="absolute left-0 top-0 h-2 w-2 border-l-2 border-t-2 border-slate-500" />
                <div className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-slate-500" />
                <img src="/images/broken_streetlights.png" alt="Broken Streetlights" className="h-[300px] w-full max-w-[500px] object-cover saturate-[0.85] transition-all duration-700 group-hover:saturate-100 md:w-[500px]" />
                <div className="absolute bottom-4 left-4 font-mono text-[9px] bg-lp-background/80 px-2 py-1 text-gray-400">STATUS: NO ACTIVE REPAIR TICKET</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* SECTION 2: THE PROCESS */}
        <div className="sys-chapter relative">
          <div className="sticky top-24 z-10 bg-lp-background/90 backdrop-blur pb-8 border-b border-lp-border mb-16">
            <h2 className="text-4xl font-black font-sans text-white tracking-widest uppercase">
              <span className="text-lp-cyan">02 //</span> HOW IT WORKS
            </h2>
          </div>

          <div className="space-y-24">
            <div className="grid grid-cols-1 gap-12">
              {[
                { step: "01", title: "Instant Reporting", desc: "Citizens take a photo and drop a pin. Our system captures precise location and time data to prevent bureaucratic denial." },
                { step: "02", title: "Smart Routing", desc: "AI automatically routes the issue to the exact zonal officer in charge. No manual sorting, no 'wrong department' excuses." },
                { step: "03", title: "Public Tracking", desc: "Every step of the repair is public. If a deadline is missed, the system escalates it automatically, visible for everyone to see." }
              ].map((item) => (
                <div key={item.step} className="flex space-x-8 items-start group">
                  <div className="landing-display text-6xl font-black text-lp-cyan/25 transition-colors group-hover:text-lp-cyan/50">{item.step}</div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-gray-400 leading-relaxed max-w-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: URBAN IMPACT (SDG) */}
        <div className="sys-chapter relative">
          <div className="sticky top-24 z-10 bg-lp-background/90 backdrop-blur pb-8 border-b border-lp-border mb-16">
            <h2 className="text-4xl font-black font-sans text-white tracking-widest uppercase">
              <span className="text-lp-green">03 //</span> GLOBAL GOALS
            </h2>
          </div>

          <div className="space-y-8">
            <p className="text-gray-400 text-lg max-w-lg mb-12 leading-relaxed">
              We're not just fixing roads; we're building a sustainable future. Every report resolved on Nagar Rakshak is mapped directly to United Nations Sustainable Development Goals.
            </p>

            <div className="grid grid-cols-1 gap-4">
              {[
                { protocol: "SDG-06", title: "Clean Water", color: "text-blue-400", desc: "Fixing drainage and leaks preserves our water table." },
                { protocol: "SDG-11", title: "Sustainable Cities", color: "text-amber-400", desc: "Making infrastructure safe and accessible for all citizens." },
                { protocol: "SDG-16", title: "Strong Institutions", color: "text-cyan-400", desc: "Eliminating corruption through radical data transparency." }
              ].map((sdg) => (
                <div key={sdg.protocol} className="border border-lp-border bg-lp-surface/30 p-6 relative group flex items-center justify-between">
                  <div>
                    <span className={`font-mono font-black text-xl ${sdg.color} mr-4`}>[{sdg.protocol}]</span>
                    <span className="font-bold text-white uppercase text-sm tracking-widest">{sdg.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 max-w-xs text-right">{sdg.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: REAL IMPACT (STATS) */}
        <div className="sys-chapter relative">
          <div className="sticky top-24 z-10 bg-lp-background/90 backdrop-blur pb-8 border-b border-lp-border mb-16">
            <h2 className="text-4xl font-black font-sans text-white tracking-widest uppercase">
              <span className="text-lp-cyan">04 //</span> BY THE NUMBERS
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {[
              { label: "Issues Tracked", value: "12,400+" },
              { label: "Successfully Resolved", value: "8,200+" },
              { label: "Resolution Rate", value: "72%" },
              { label: "Localities Covered", value: "14" }
            ].map((stat) => (
              <div key={stat.label} className="p-8 border border-lp-border bg-lp-surface/20">
                <div className="text-4xl font-black text-white mb-2">{stat.value}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: FOOTER */}
        <div className="sys-chapter relative pb-32">
          <div className="h-px bg-lp-border mb-32" />
          <h3 className="text-4xl font-black text-white mb-8">Ready to make your city accountable?</h3>
          <p className="text-gray-400 max-w-lg mb-12 leading-relaxed">
            Nagar Rakshak is currently active in 14 localities across Hyderabad. Join thousands of citizens who are reclaiming their streets through data.
          </p>
          <div className="font-mono text-[10px] text-gray-600 flex justify-between uppercase tracking-[0.2em]">
            <span>© 2024 Nagar Rakshak Hyderabad</span>
            <span>Secured Connection // All access logged</span>
          </div>
        </div>

      </div>
    </div>
  );
}

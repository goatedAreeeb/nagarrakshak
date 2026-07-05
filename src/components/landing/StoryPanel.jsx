import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const CASES = [
  {
    place: 'Tolichowki',
    title: 'A leaking school roof, ranked against every other need',
    body: 'Parents report two unusable classrooms before monsoon. UDISE+ enrollment data confirms falling attendance at the same school — citizen demand and independent evidence point the same way.',
    image: '/images/flooded_street.png',
    alt: 'School building in Tolichowki',
    note: 'Rank #2 · school_infrastructure',
  },
  {
    place: 'Miyapur',
    title: 'A water-supply gap, weighed against population served',
    body: 'Multiple households report dry taps. The score is normalized by population served, not just complaint count, so a smaller but more severely affected area is not out-ranked by a louder one.',
    image: '/images/pothole_road.png',
    alt: 'Water supply infrastructure in Miyapur',
    note: 'Rank #5 · water_supply',
  },
  {
    place: 'Secunderabad',
    title: 'A road-repair request, routed to the right authority',
    body: 'MPLADS-eligibility is checked before it ever reaches a shortlist. Ineligible requests are referred onward rather than silently dropped or wrongly recommended.',
    image: '/images/broken_streetlights.png',
    alt: 'Road infrastructure in Secunderabad',
    note: 'Referred · district authority',
  },
];

const heroEase = [0.22, 1, 0.36, 1];

const SDG_GOALS = [
  {
    code: 'SDG 1',
    title: 'No poverty',
    desc: 'Budget-constrained ranking directs limited development funds where evidence says need is greatest.',
    variant: 'sdg6',
  },
  {
    code: 'SDG 10',
    title: 'Reduced inequalities',
    desc: 'Population-normalized scoring so a smaller, quieter constituency is not out-ranked by a louder one.',
    variant: 'sdg11',
  },
  {
    code: 'SDG 16',
    title: 'Peace, justice & strong institutions',
    desc: 'Every rank is explainable and auditable — human override always requires a logged reason.',
    variant: 'sdg16',
  },
];

export default function StoryPanel({ onSectionChange }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const sections = containerRef.current.querySelectorAll('.sys-chapter');
      const scrollPosition = containerRef.current.scrollTop + window.innerHeight / 3;

      let currentSection = 0;
      sections.forEach((section, index) => {
        if (scrollPosition >= section.offsetTop) currentSection = index;
      });
      onSectionChange(currentSection);
    };

    const container = containerRef.current;
    if (!container) return undefined;
    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onSectionChange]);

  const scrollToContent = () => {
    containerRef.current?.querySelector('#on-the-ground')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="story-panel">
      <div className="story-panel__inner">
        <section className="story-cover sys-chapter">
          <div className="story-cover__center">
            <motion.p
              className="story-cover__city"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: heroEase }}
            >
              Hyderabad Parliamentary Constituency · Demo
            </motion.p>

            <h1 className="story-cover__hero" aria-label="Every need. Ranked fairly.">
              <motion.span
                className="story-cover__hero-line"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: heroEase }}
              >
                Every need.
              </motion.span>
              <motion.span
                className="story-cover__hero-line story-cover__hero-line--voice"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.24, ease: heroEase }}
              >
                Ranked fairly.
              </motion.span>
            </h1>

            <motion.p
              className="story-cover__tag"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: heroEase }}
            >
              Citizen demand fused with public evidence — a transparent, budget-constrained ranking for the MP's office.
            </motion.p>

            <motion.button
              type="button"
              className="story-cover__scroll"
              onClick={scrollToContent}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.65, ease: heroEase }}
              aria-label="Scroll to content"
            >
              <ChevronDown className="story-cover__scroll-icon" strokeWidth={1.75} aria-hidden />
              <span className="story-cover__scroll-label">Scroll</span>
            </motion.button>
          </div>
        </section>

        <section id="on-the-ground" className="story-scroll sys-chapter">
          <h2 className="story-scroll__heading">On the ground</h2>
          <p className="story-scroll__lede">
            Demand from constituents, fused with independent public evidence — not one signal alone.
          </p>

          <div className="story-cases">
            {CASES.map((item) => (
              <article key={item.place} className="story-case">
                <p className="story-case__place">{item.place}</p>
                <h3 className="story-case__title">{item.title}</h3>
                <p className="story-case__body">{item.body}</p>
                <figure className="story-case__figure">
                  <img src={item.image} alt={item.alt} loading="lazy" />
                  <figcaption>{item.note}</figcaption>
                </figure>
              </article>
            ))}
          </div>
        </section>

        <section className="story-scroll sys-chapter">
          <h2 className="story-scroll__heading">Who uses it</h2>
          <div className="story-scroll__prose">
            <p>
              <strong>Citizens</strong> submit in their own language—voice, photo, or text—and every submission counts even when duplicated.
            </p>
            <p>
              <strong>MP staff</strong> review a ranked shortlist with visible weights and cited evidence, not a raw inbox.
            </p>
            <p>
              <strong>The MP</strong> makes the final call — every override is logged with a reason, never silent.
            </p>
          </div>
        </section>

        <section className="story-scroll sys-chapter">
          <h2 className="story-scroll__heading">UN Sustainable Development Goals</h2>
          <p className="story-scroll__lede">
            A defensible, auditable basis for allocation decisions maps directly to global development targets.
          </p>

          <ul className="story-sdg">
            {SDG_GOALS.map((sdg) => (
              <li key={sdg.code} className={`story-sdg__card story-sdg__card--${sdg.variant}`}>
                <span className="story-sdg__code">{sdg.code}</span>
                <div className="story-sdg__body">
                  <span className="story-sdg__title">{sdg.title}</span>
                  <p className="story-sdg__desc">{sdg.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <footer className="story-scroll story-scroll--end sys-chapter">
          <p className="story-end__copy">People's Priorities · Hyderabad Parliamentary Constituency (Demo)</p>
        </footer>
      </div>
    </div>
  );
}

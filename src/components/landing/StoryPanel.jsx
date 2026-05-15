import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const CASES = [
  {
    place: 'Tolichowki',
    title: 'Drainage overflows every monsoon',
    body: 'Residents file the same flooding complaint each year. The ticket stays open with photos, dates, and ward assignment until GHMC records an action.',
    image: '/images/flooded_street.png',
    alt: 'Flooded lane in Tolichowki',
    note: 'Open 180 days',
  },
  {
    place: 'Miyapur',
    title: 'Potholes on the main road',
    body: 'A stretch near the metro was reported multiple times. Public status shows whether it was marked in progress, deferred, or closed—neighbours can verify.',
    image: '/images/pothole_road.png',
    alt: 'Damaged road in Miyapur',
    note: 'Marked urgent',
  },
  {
    place: 'Secunderabad',
    title: 'Streetlights out for weeks',
    body: 'After sunset the lane stays dark. Here every report gets a ticket number and an officer name from the day it is filed.',
    image: '/images/broken_streetlights.png',
    alt: 'Broken streetlights in Secunderabad',
    note: 'No closure yet',
  },
];

const heroEase = [0.22, 1, 0.36, 1];

const SDG_GOALS = [
  {
    code: 'SDG 6',
    title: 'Clean water & sanitation',
    desc: 'Drainage, leaks, and flooding reports tied to accountable fixes.',
    variant: 'sdg6',
  },
  {
    code: 'SDG 11',
    title: 'Sustainable cities',
    desc: 'Safer roads, lighting, and public spaces tracked ward by ward.',
    variant: 'sdg11',
  },
  {
    code: 'SDG 16',
    title: 'Peace, justice & strong institutions',
    desc: 'Public timelines so civic response cannot disappear quietly.',
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
              Hyderabad
            </motion.p>

            <h1 className="story-cover__hero" aria-label="Your city. Your voice.">
              <motion.span
                className="story-cover__hero-line"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: heroEase }}
              >
                Your city.
              </motion.span>
              <motion.span
                className="story-cover__hero-line story-cover__hero-line--voice"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.24, ease: heroEase }}
              >
                Your voice.
              </motion.span>
            </h1>

            <motion.p
              className="story-cover__tag"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: heroEase }}
            >
              Complaints on the map. Fixes on the record.
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
            Live zones on the map. Real reports from Hyderabad neighbourhoods.
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
              <strong>Residents</strong> file from their phone—photo, pin, short note.
            </p>
            <p>
              <strong>Ward officers</strong> receive tickets for their area and update status.
            </p>
            <p>
              <strong>City heads</strong> see which wards fall behind on the same map you see here.
            </p>
          </div>
        </section>

        <section className="story-scroll sys-chapter">
          <h2 className="story-scroll__heading">UN Sustainable Development Goals</h2>
          <p className="story-scroll__lede">
            Resolved issues on Nagar Rakshak align with global targets—city infrastructure work maps
            to outcomes citizens can recognise.
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
          <p className="story-end__copy">Nagar Rakshak · Hyderabad</p>
        </footer>
      </div>
    </div>
  );
}

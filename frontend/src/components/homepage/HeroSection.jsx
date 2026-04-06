import React from 'react';
import { Link } from 'react-router-dom';
import { MoveRight } from 'lucide-react';

const HeroSection = () => (
  <section className="home2-hero" aria-label="Homepage hero">
    <div className="home2-hero-inner">
      <p className="home2-kicker">After the Last Page</p>
      <h1 className="home2-hero-title font-serif">Where the story ends, the conversation begins.</h1>
      <p className="home2-hero-subtitle">
        Read in calm, then step into thoughtful conversation with readers who reached the same final page.
      </p>
      <div className="home2-hero-actions">
        <Link to="/auth" className="home2-btn home2-btn-primary">
          Start Reading <MoveRight size={15} />
        </Link>
        <Link to="/meet" className="home2-btn home2-btn-secondary">Discover Readers</Link>
      </div>
    </div>
  </section>
);

export default HeroSection;

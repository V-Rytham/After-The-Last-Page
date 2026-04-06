import React from 'react';
import { Link } from 'react-router-dom';

const EmotionalSection = () => (
  <section className="home2-emotional" aria-label="Reading reflection">
    <div className="home2-emotional-copy">
      <h2 className="font-serif">What happens after you finish a book?</h2>
      <p>
        The final page closes, but the emotion stays with you. Keep that momentum going in thoughtful spaces built for readers who actually made it to the end.
      </p>
      <Link to="/meet" className="home2-btn home2-btn-primary">Join the conversation</Link>
    </div>
  </section>
);

export default EmotionalSection;

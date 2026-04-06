import React from 'react';

const ExperienceCard = ({ title, description, tone }) => (
  <article className={`home2-exp-card home2-exp-${tone}`}>
    <div>
      <h3 className="font-serif">{title}</h3>
      <p>{description}</p>
    </div>
  </article>
);

export default ExperienceCard;

import React from 'react';

const buildInitials = (value, idx) => {
  const text = String(value || `R${idx + 1}`).trim();
  const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || `R${idx + 1}`;
};

const MeetReadersCard = ({ readers = [], count = 0 }) => {
  const visibleReaders = readers.slice(0, 3);
  const displayCount = Number.isFinite(Number(count)) ? Number(count) : visibleReaders.length;

  return (
    <article className="home2-card home2-stack-card">
      <p className="home2-kicker">Meet Readers</p>
      <div className="home2-avatar-row" aria-hidden="true">
        {visibleReaders.map((reader, idx) => (
          <span key={`${reader}-${idx}`} className="home2-avatar">{buildInitials(reader, idx)}</span>
        ))}
        {visibleReaders.length === 0 ? <span className="home2-avatar">R</span> : null}
      </div>
      <p className="home2-muted">
        {displayCount} people recently finished books on your list
      </p>
    </article>
  );
};

export default MeetReadersCard;

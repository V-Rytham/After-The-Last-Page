import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, BookX } from 'lucide-react';
import './UnavailableBookState.css';

export default function UnavailableBookState({
  sourceUrl,
  onExternalClick,
}) {
  const navigate = useNavigate();

  const safeSourceUrl = String(sourceUrl || '').trim();

  return (
    <main className="unavailable-book-page content-container animate-fade-in">
      <section className="unavailable-book-card glass-panel" aria-label="Book unavailable">
        <div className="unavailable-book-illustration" aria-hidden="true">
          <div className="unavailable-book-icon">
            <BookX size={26} />
          </div>
        </div>

        <div className="unavailable-book-copy">
          <h1 className="font-serif unavailable-book-title">We can’t show this book here.</h1>
          <p className="unavailable-book-subtitle">Preview or borrow it from the source.</p>
        </div>

        <div className="unavailable-book-actions" role="group" aria-label="Next steps">
          {safeSourceUrl ? (
            <a
              className="btn-primary unavailable-book-primary"
              href={safeSourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                try {
                  onExternalClick?.(safeSourceUrl);
                } catch {
                  // ignore
                }
              }}
            >
              Preview on source <ExternalLink size={16} />
            </a>
          ) : null}

          <button
            type="button"
            className="btn-secondary unavailable-book-secondary"
            onClick={() => {
              try {
                window.history.back();
              } catch {
                navigate(-1);
              }
            }}
          >
            Go back <ArrowLeft size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}

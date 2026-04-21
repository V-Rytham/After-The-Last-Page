import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchBar from '../components/library/SearchBar';
import BookGrid from '../components/library/BookGrid';
import useSelectedGenres from '../hooks/useSelectedGenres';
import useRecommendations from '../hooks/useRecommendations';
import useOnboarding from '../hooks/useOnboarding';
import OnboardingTooltip from '../components/onboarding/OnboardingTooltip';
import { getCachedSearch, setCachedSearch } from '../utils/searchCache';
import AuthRequired from '../components/auth/AuthRequired';
import { getApiBaseUrl } from '../utils/serviceUrls';
import './Library.css';

const normalizeQuery = (value) => String(value || '').trim();
const BASE_URL = getApiBaseUrl();

const debounce = (fn, delay) => {
  let timeoutId;

  const debouncedFn = (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };

  debouncedFn.cancel = () => {
    window.clearTimeout(timeoutId);
  };

  return debouncedFn;
};

export default function Library({ currentUser }) {
  const selectedGenres = useSelectedGenres();
  const { books: personalizedBooks, loading: recLoading, error: recError } = useRecommendations(selectedGenres);

  const { step: onboardingStep, completed: onboardingCompleted, highlightBookId, nextStep } = useOnboarding();

  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState({ loading: false, error: null, results: [] });
  const controllerRef = useRef(null);

  const searchBooks = useCallback(async (inputQuery) => {
    const normalizedQuery = normalizeQuery(inputQuery);

    if (controllerRef.current) controllerRef.current.abort();

    if (!normalizedQuery) {
      setSearchState({ loading: false, error: null, results: [] });
      return;
    }

    const cached = getCachedSearch(normalizedQuery);
    if (cached) {
      setSearchState({ loading: false, error: null, results: cached });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setSearchState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(normalizedQuery)}`, {
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      const data = await res.json();
      const results = Array.isArray(data?.books) ? data.books : [];

      setCachedSearch(normalizedQuery, results);
      setSearchState({ loading: false, error: null, results });

      if (!onboardingCompleted && onboardingStep === 1) {
        nextStep();
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setSearchState({ loading: false, error: 'Something went wrong', results: [] });
    }
  }, [nextStep, onboardingCompleted, onboardingStep]);

  const debouncedSearch = useMemo(
    () => debounce(searchBooks, 300),
    [searchBooks],
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [debouncedSearch, query]);

  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (onboardingCompleted) return undefined;
    if (onboardingStep !== 2) return undefined;
    if (!highlightBookId) return undefined;

    const timeout = window.setTimeout(() => nextStep(), 3000);
    return () => window.clearTimeout(timeout);
  }, [highlightBookId, nextStep, onboardingCompleted, onboardingStep]);

  const isMember = Boolean(currentUser && !currentUser.isAnonymous);

  if (!isMember) {
    return <AuthRequired previewClassName="library-page" previewLabel="Preview your future library after signing in." />;
  }

  const normalizedSearch = normalizeQuery(query);
  const showSearchResults = Boolean(normalizedSearch);
  const loading = showSearchResults ? searchState.loading : recLoading;
  const error = showSearchResults ? searchState.error : recError;
  const results = showSearchResults ? searchState.results : personalizedBooks;

  return (
    <main className="library-page content-container">
      {!onboardingCompleted && onboardingStep === 1 ? (
        <OnboardingTooltip
          targetSelector='[data-onboarding="search-input"]'
          placement="bottom"
          text="Search any book (try 'Atomic Habits')"
        />
      ) : null}

      {!onboardingCompleted && onboardingStep === 2 && highlightBookId ? (
        <OnboardingTooltip
          targetSelector='[data-onboarding="added-book-card"]'
          placement="top"
          text="This is your library. Track everything here."
        />
      ) : null}

      <header className="library-page-header">
        <h1>{showSearchResults ? 'Search' : 'Curated For You'}</h1>
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={() => {}}
          categories={[]}
          activeCategory={null}
          onCategoryChange={() => {}}
          inputClassName={!onboardingCompleted && onboardingStep === 1 ? 'onboarding-target-glow' : ''}
        />

        {showSearchResults && loading ? (
          <div className="mt-2 text-sm opacity-60" role="status" aria-live="polite">
            Searching...
          </div>
        ) : null}

        {!showSearchResults && selectedGenres.length === 0 ? (
          <p className="library-inline-message" role="status">Pick genres in your Profile to personalize this feed.</p>
        ) : null}
      </header>

      {error ? (
        <div className="library-empty" role="status">Something went wrong</div>
      ) : null}

      {!error && showSearchResults && !loading && results.length === 0 ? (
        <div className="mt-6 text-sm opacity-60" role="status">No books found. Try a different title.</div>
      ) : null}

      {!error && (!showSearchResults || !loading) && (showSearchResults ? results.length > 0 : true) ? (
        <BookGrid
          books={results}
          loading={!showSearchResults && loading}
          error=""
          onboardingHighlightBookId={!onboardingCompleted && onboardingStep === 2 ? highlightBookId : ''}
        />
      ) : null}
    </main>
  );
}

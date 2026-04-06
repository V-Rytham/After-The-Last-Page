import { useEffect, useMemo, useRef, useState } from 'react';
import { parseJsonSafely } from '../utils/http';
import { buildApiUrl } from '../utils/serviceUrls';

const normalizeBooksList = (data) => {
  if (Array.isArray(data?.books)) return data.books;
  if (Array.isArray(data?.recommendations)) return data.recommendations;
  if (Array.isArray(data?.data?.books)) return data.data.books;
  if (Array.isArray(data?.data?.recommendations)) return data.data.recommendations;
  return [];
};

export default function useRecommendations(selectedGenres) {
  const [state, setState] = useState({ books: [], personalized: false, loading: false, error: '' });
  const abortRef = useRef(null);

  useEffect(() => {
    if (selectedGenres.length === 0) return;

    console.log('SELECTED GENRES:', selectedGenres);
    console.log('FETCHING RECOMMENDATIONS');

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    Promise.resolve().then(() => setState((prev) => ({ ...prev, loading: true, error: '' })));

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    fetch(buildApiUrl('/recommendations'), {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ genres: selectedGenres }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        return parseJsonSafely(res);
      })
      .then((data) => {
        const books = normalizeBooksList(data);
        console.log('BOOKS RECEIVED:', books);

        const emptyMessage = books.length === 0
          ? 'No recommendations returned. Please retry in a few seconds.'
          : '';

        Promise.resolve().then(() => setState({
          books,
          personalized: Boolean(data?.personalized) || books.length > 0,
          loading: false,
          error: emptyMessage,
        }));
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        Promise.resolve().then(() => setState({ books: [], personalized: false, loading: false, error: err?.message || 'Failed to fetch recommendations.' }));
      });

    return () => controller.abort();
  }, [selectedGenres]);

  return useMemo(() => state, [state]);
}

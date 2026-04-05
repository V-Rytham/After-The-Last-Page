import React, { useEffect, useState } from 'react';
import SearchBar from '../components/library/SearchBar';
import BookGrid from '../components/library/BookGrid';
import { fetchDefaultBooks, searchBooks } from '../utils/libraryApi';
import './Library.css';

const Library = () => {
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!String(search || '').trim()) {
      setSubmittedSearch('');
    }
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const results = submittedSearch
          ? await searchBooks(submittedSearch, controller.signal)
          : await fetchDefaultBooks(controller.signal);
        setBooks(results);
      } catch (requestError) {
        setBooks([]);
        setError(String(requestError?.uiMessage || requestError?.message || 'Unable to load books right now.'));
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [submittedSearch]);

  return (
    <main className="library-page content-container">
      <header className="library-page-header">
        <h1>Library</h1>
        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={() => {
            setSearch('');
            setSubmittedSearch('');
            setError('');
          }}
          onSubmit={() => setSubmittedSearch(String(search || '').trim())}
          loading={loading}
        />
      </header>

      <BookGrid books={books} loading={loading} error={error || (!loading && submittedSearch && books.length === 0 ? 'Book not found' : '')} />
    </main>
  );
};

export default Library;

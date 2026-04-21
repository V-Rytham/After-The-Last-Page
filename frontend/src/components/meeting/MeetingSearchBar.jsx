import React from 'react';
import { Search } from 'lucide-react';

export default function MeetingSearchBar({
  id,
  value,
  onChange,
  placeholder,
  autoFocus = false,
}) {
  return (
    <label className="meeting-search-bar" htmlFor={id}>
      <Search size={18} aria-hidden="true" className="meeting-search-bar-icon" />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        autoFocus={autoFocus}
        aria-label="Search books to meet"
      />
    </label>
  );
}

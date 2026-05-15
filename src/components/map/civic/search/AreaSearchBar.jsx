import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCivicStore } from '../civicStore';
import { useDebounce } from '../useDebounce';
import { createFuseIndex, searchAreas } from './searchIndex';
import SearchDropdown from './SearchDropdown';

export default function AreaSearchBar() {
  const searchEntries = useCivicStore((s) => s.searchEntries);
  const selectFromSearch = useCivicStore((s) => s.selectFromSearch);
  const selectedWardId = useCivicStore((s) => s.selectedWard?.wardId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const fuse = useMemo(() => createFuseIndex(searchEntries), [searchEntries]);
  const debouncedQuery = useDebounce(query, 140);
  const results = useMemo(
    () => (!debouncedQuery.trim() ? [] : searchAreas(fuse, debouncedQuery)),
    [fuse, debouncedQuery],
  );

  useEffect(() => {
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const pick = useCallback(
    (entry) => {
      selectFromSearch(entry);
      setQuery(entry.label);
      setOpen(false);
      inputRef.current?.blur();
    },
    [selectFromSearch],
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  };

  const showDropdown = open && debouncedQuery.trim().length > 0;

  return (
    <div className="area-search" ref={wrapRef}>
      <div
        className={[
          'area-search__bar',
          focused ? 'area-search__bar--focus' : '',
          showDropdown ? 'area-search__bar--open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <svg className="area-search__icon" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          className="area-search__input"
          placeholder="Search area, ward, locality..."
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {query.length > 0 && (
          <button
            type="button"
            className="area-search__clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
          >
            ×
          </button>
        )}
      </div>
      {showDropdown && (
        <SearchDropdown
          results={results}
          activeIndex={activeIndex}
          selectedId={selectedWardId}
          onHoverIndex={setActiveIndex}
          onSelect={pick}
          listId={listId}
        />
      )}
    </div>
  );
}

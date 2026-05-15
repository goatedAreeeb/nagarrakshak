import { memo } from 'react';

function SearchDropdown({ results, activeIndex, selectedId, onHoverIndex, onSelect, listId }) {
  if (!results.length) {
    return (
      <ul className="area-search__dropdown" role="listbox" id={listId}>
        <li className="area-search__empty">No matching areas — try another spelling</li>
      </ul>
    );
  }
  return (
    <ul className="area-search__dropdown" role="listbox" id={listId}>
      {results.map((entry, index) => (
        <li key={entry.id} role="presentation">
          <button type="button" role="option" aria-selected={index === activeIndex}
            className={['area-search__option', index === activeIndex ? 'area-search__option--active' : '', entry.id === selectedId ? 'area-search__option--picked' : ''].filter(Boolean).join(' ')}
            onMouseEnter={() => onHoverIndex(index)} onClick={() => onSelect(entry)}>
            <span className="area-search__option-label">{entry.label}</span>
            <span className="area-search__option-meta">{entry.subtitle}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default memo(SearchDropdown);

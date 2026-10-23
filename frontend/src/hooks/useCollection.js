import { useMemo, useState } from 'react';

export function useCollection(items = [], searchFields = []) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = !query || searchFields.some((field) => String(item[field] ?? '').toLowerCase().includes(query.toLowerCase()));
    const matchesFilter = filter === 'All' || Object.values(item).some((value) => String(value).toLowerCase() === filter.toLowerCase());
    return matchesQuery && matchesFilter;
  }), [items, query, filter, searchFields]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const current = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { query, setQuery: (value) => { setQuery(value); setPage(1); }, filter, setFilter: (value) => { setFilter(value); setPage(1); }, page: safePage, setPage, pageCount, filtered, current };
}

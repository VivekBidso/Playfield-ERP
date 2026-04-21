import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

/**
 * Server-side search input for selecting items.
 * 
 * Mode 1 (Stock search): branch + type provided → searches items with stock > 0
 * Mode 2 (SKU search): searchEndpoint provided → searches buyer SKUs from catalog
 * 
 * Props:
 *   branch (string) - Branch name (for stock search mode)
 *   type (string) - "RM" or "FG" (for stock search mode)
 *   searchEndpoint (string) - Custom endpoint URL (overrides stock search)
 *   value (string) - Currently selected item_id
 *   onSelect (fn) - Called with { item_id, name, current_stock } when item selected
 *   disabled (boolean)
 *   placeholder (string)
 *   excludeIds (string[]) - Item IDs to exclude from results
 *   testId (string) - data-testid
 *   minChars (number) - Min chars before search triggers (default 2)
 */
const StockItemSearch = ({ branch, type = "RM", searchEndpoint, value, onSelect, disabled, placeholder, excludeIds = [], testId, minChars = 2 }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Update label when value changes externally
  useEffect(() => {
    if (value && !selectedLabel) {
      setSelectedLabel(value);
    }
    if (!value) {
      setSelectedLabel('');
      setQuery('');
    }
  }, [value]);

  const search = useCallback(async (q) => {
    if (q.length < minChars) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let items = [];

      if (searchEndpoint) {
        // Custom endpoint mode — append q as query parameter
        const separator = searchEndpoint.includes('?') ? '&' : '?';
        const url = `${searchEndpoint}${separator}q=${encodeURIComponent(q)}&limit=20`;
        const res = await axios.get(url, { headers });
        const data = res.data;
        // Normalize: could be array or { items: [] } or { buyer_skus: [] }
        const rawItems = Array.isArray(data) ? data : (data.items || data.buyer_skus || []);
        items = rawItems.map(s => ({
          item_id: s.buyer_sku_id || s.sku_id || s.item_id,
          name: s.name || s.description || '',
          current_stock: s.current_stock || s.quantity || null
        }));
      } else {
        // Stock search mode
        if (!branch) { setResults([]); setLoading(false); return; }
        const res = await axios.get(`${API}/stock-search`, {
          params: { branch, type, q, limit: 20 },
          headers
        });
        items = res.data.items || [];
      }

      setResults(items.filter(i => !excludeIds.includes(i.item_id)).slice(0, 20));
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    }
    setLoading(false);
  }, [branch, type, searchEndpoint, excludeIds, minChars]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedLabel('');
    setOpen(true);

    if (value) {
      onSelect({ item_id: '', name: '', current_stock: 0 });
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (item) => {
    setSelectedLabel(`${item.item_id} - ${item.name?.substring(0, 25)}`);
    setQuery('');
    setOpen(false);
    setResults([]);
    onSelect(item);
  };

  const displayValue = selectedLabel || query;
  const isDisabled = disabled || (!branch && !searchEndpoint);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        data-testid={testId}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        disabled={isDisabled}
        placeholder={placeholder || (isDisabled ? "Select branch first" : `Type ${minChars}+ chars to search...`)}
        className="text-sm h-9"
      />
      
      {open && (results.length > 0 || loading || (query.length >= minChars && !loading)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-zinc-400">Searching...</div>
          )}
          {!loading && results.length === 0 && query.length >= minChars && (
            <div className="px-3 py-2 text-xs text-zinc-400">No items found</div>
          )}
          {results.map(item => (
            <button
              key={item.item_id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 flex justify-between items-center border-b border-zinc-50 last:border-0"
              onClick={() => handleSelect(item)}
              data-testid={`search-result-${item.item_id}`}
            >
              <span className="truncate flex-1">
                <span className="font-medium text-zinc-900">{item.item_id}</span>
                <span className="text-zinc-500 ml-1">- {item.name?.substring(0, 35)}</span>
              </span>
              {item.current_stock != null && (
                <span className="text-xs font-mono text-emerald-600 ml-2 whitespace-nowrap">
                  {item.current_stock}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockItemSearch;

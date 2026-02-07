import { useEffect, useRef, useState } from 'react';

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (lat: number, lon: number) => void;
}

export default function AddressAutocomplete({ value, onChange, onLocationSelect }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value || value.length < 3 || !isFocused) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // USA bounding box: [min_lon, min_lat, max_lon, max_lat]
        const viewbox = '-125,24,-66,50'; // USA bounds
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=8&viewbox=${viewbox}&bounded=1&countrycodes=us`
        );
        const data = await response.json();
        
        const parsed = data.map((item: any) => ({
          label: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }));
        
        setSuggestions(parsed);
        setIsOpen(parsed.length > 0);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value, isFocused]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.label);
    onLocationSelect?.(suggestion.lat, suggestion.lon);
    setIsOpen(false);
    setIsFocused(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay blur to allow click on suggestions
          setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
              setIsFocused(false);
            }
          }, 100);
        }}
        placeholder="Search address"
        className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50"
      />
      
      {loading && isFocused && (
        <div className="absolute right-2 top-1">
          <div className="w-3 h-3 border border-neon/50 border-t-neon rounded-full animate-spin" />
        </div>
      )}

      {isOpen && isFocused && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-0.5 bg-slate-900 border border-white/20 rounded shadow-2xl z-[9999] overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-2 py-1 hover:bg-white/5 border-b border-white/5 last:border-b-0 text-xs text-slate-100 transition"
            >
              <div className="text-xs truncate font-medium">{suggestion.label.split(',')[0]}</div>
              <div className="text-[10px] text-slate-400 truncate">{suggestion.label.substring(suggestion.label.indexOf(',') + 1)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Grid3x3, Loader2, Search, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  type: string;
  url: string;
  description: string;
  logoUrl: string | null;
  mainImageUrl: string | null;
  color?: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

// Same 8-color palette tenant-boilerplate's module registry uses (see
// COLOR_BG/COLOR_TEXT in its components/apps/app-tile.tsx) — kept in sync
// by hand so every Prabisha repo's switcher looks the same.
const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950/40', green: 'bg-green-50 dark:bg-green-950/40',
  purple: 'bg-purple-50 dark:bg-purple-950/40', orange: 'bg-orange-50 dark:bg-orange-950/40',
  indigo: 'bg-indigo-50 dark:bg-indigo-950/40', pink: 'bg-pink-50 dark:bg-pink-950/40',
  red: 'bg-red-50 dark:bg-red-950/40', yellow: 'bg-yellow-50 dark:bg-yellow-950/40',
};
const COLOR_TEXT: Record<string, string> = {
  blue: 'text-blue-600 dark:text-blue-400', green: 'text-green-600 dark:text-green-400',
  purple: 'text-purple-600 dark:text-purple-400', orange: 'text-orange-600 dark:text-orange-400',
  indigo: 'text-indigo-600 dark:text-indigo-400', pink: 'text-pink-600 dark:text-pink-400',
  red: 'text-red-600 dark:text-red-400', yellow: 'text-yellow-600 dark:text-yellow-400',
};

function isCurrentProduct(url: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

/**
 * "All apps" switcher — ported from pm/Prabisha-DMA's identical component so
 * all Prabisha repos show the same panel, sourced from the same list
 * (tenant-boilerplate's /api/public/prabisha-products via this repo's own
 * /api/our-products proxy — see that route for why it's proxied rather than
 * fetched directly).
 */
export default function ProductsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && products.length === 0) {
      fetchProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/our-products');

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [products, query],
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-9 rounded-full hover:bg-accent dark:hover:bg-gray-800 transition-colors"
        aria-label="All Prabisha apps"
        title="All apps"
      >
        <Grid3x3 className="w-5 h-5" />
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-border dark:border-border z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4">
            <div className="flex gap-4 justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prabisha Products</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {products.length} {products.length === 1 ? 'app' : 'apps'} available
              </p>
            </div>

            {products.length > 3 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search apps…"
                  className="w-full h-8 pl-8 pr-7 text-sm rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[440px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Error loading products</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{error}</p>
                  <button
                    onClick={fetchProducts}
                    className="mt-3 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No products available</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No apps match "{query}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filtered.map((product) => {
                    const isCurrent = isCurrentProduct(product.url);
                    return (
                      <a
                        key={product.id}
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                        onClick={() => setIsOpen(false)}
                        title={isCurrent ? 'You are here' : product.description}
                      >
                        <div className={cn(
                          'relative w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden mb-2 group-hover:scale-105 transition-transform',
                          COLOR_BG[product.color ?? ''] ?? 'bg-gray-100 dark:bg-gray-700',
                          isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-gray-800',
                        )}>
                          {product.logoUrl || product.mainImageUrl ? (
                            <Image
                              src={product.logoUrl || product.mainImageUrl || ''}
                              alt={product.name || 'Product'}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Grid3x3 className={cn('w-6 h-6', COLOR_TEXT[product.color ?? ''] ?? 'text-gray-600 dark:text-gray-300')} />
                          )}
                          {isCurrent && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-sm">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white text-center line-clamp-2">
                          {product.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-medium text-primary">You are here</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

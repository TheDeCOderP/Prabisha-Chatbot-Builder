'use client';

import { useState, useEffect, useRef } from 'react';
import { Grid3x3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  type: string;
  url: string;
  description: string;
  logoUrl: string | null;
  mainImageUrl: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * "All apps" switcher — ported from pm/Prabisha-DMA's identical component so
 * all three Prabisha repos show the same panel, sourced from the same list
 * (tenant-boilerplate's /api/public/prabisha-products via this repo's own
 * /api/our-products proxy — see that route for why it's proxied rather than
 * fetched directly).
 */
export default function ProductsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] max-w-[380px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-border dark:border-border z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4">
            <div className="flex gap-4 justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prabisha Products</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {products.length} {products.length === 1 ? 'app' : 'apps'} available
              </p>
            </div>

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
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {products.map((product) => (
                    <a
                      key={product.id}
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                      onClick={() => setIsOpen(false)}
                      title={product.description}
                    >
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden mb-2 group-hover:scale-105 transition-transform">
                        {product.logoUrl || product.mainImageUrl ? (
                          <Image
                            src={product.logoUrl || product.mainImageUrl || ''}
                            alt={product.name || 'Product'}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Grid3x3 className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white text-center line-clamp-2">
                        {product.name}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

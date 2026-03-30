"use client";

import * as React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import { Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

// ==================== Types ====================
interface TrustItem {
  id: string;
  name: string;
  logo?: string;
  icon?: React.ElementType;
  url?: string;
}

interface InfiniteCarouselProps {
  items: TrustItem[];
  speed?: number; // Speed of auto scroll
  pauseOnHover?: boolean;
  showGradientOverlay?: boolean;
  showArrows?: boolean;
  autoPlay?: boolean;
  direction?: 'forward' | 'backward';
}

export default function InfiniteCarousel({ 
  items, 
  speed = 1, // Default speed
  pauseOnHover = true,
  showGradientOverlay = true,
  showArrows = false,
  autoPlay = true,
  direction = 'forward'
}: InfiniteCarouselProps) {
  // Ensure we have enough items for smooth looping
  const displayItems = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    // Repeat items until we have enough to fill the screen twice
    let repeated = [...items];
    while (repeated.length < 15) {
      repeated = [...repeated, ...items];
    }
    return repeated;
  }, [items]);
  
  const options: EmblaOptionsType = React.useMemo(() => ({
    loop: true,
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: 1,
  }), []);

  // Configure auto-scroll plugin
  const autoScrollPlugin = React.useMemo(() => {
    if (!autoPlay) return undefined;
    
    return AutoScroll({
      speed: direction === 'forward' ? speed : -speed,
      stopOnInteraction: false,
      stopOnMouseEnter: pauseOnHover,
      playOnInit: true,
    });
  }, [autoPlay, speed, pauseOnHover, direction]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    options, 
    autoScrollPlugin ? [autoScrollPlugin] : []
  );

  const scrollPrev = React.useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = React.useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  return (
    <div className="relative w-full group">
      {/* Navigation Arrows */}
      {showArrows && (
        <>
          <button
            onClick={scrollPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </>
      )}
      
      {/* Gradient Overlay (optional) */}
      {showGradientOverlay && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10" />
        </>
      )}
      
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {displayItems.map((item, index) => (
            <div 
              key={`${item.id}-${index}`} 
              className="flex-[0_0_200px] min-w-0 px-6 flex items-center justify-center"
            >
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-400 font-bold text-sm whitespace-nowrap transition-all duration-300 hover:scale-105 hover:text-slate-600"
                >
                  {item.logo ? (
                    <img 
                      src={item.logo} 
                      alt={item.name}
                      className="max-h-8 w-auto object-contain transition-all duration-300"
                    />
                  ) : item.icon ? (
                    React.createElement(item.icon, { className: "w-5 h-5 text-slate-400" })
                  ) : (
                    <Briefcase className="w-5 h-5 text-slate-400" />
                  )}
                  <span>{item.name}</span>
                </a>
              ) : (
                <div className="flex items-center justify-center transition-all duration-300 hover:scale-105">
                  {item.logo ? (
                    <Image
                      width={120}
                      height={60}
                      src={item.logo}
                      alt={item.name}
                      className="object-contain max-h-12 w-auto"
                      priority={index < 5}
                    />
                  ) : item.icon ? (
                    React.createElement(item.icon, { className: "w-8 h-8 text-slate-400" })
                  ) : (
                    <Briefcase className="w-8 h-8 text-slate-400" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
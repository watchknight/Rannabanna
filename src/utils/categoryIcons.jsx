import React from 'react';
import {
  Utensils,
  Beef,
  Carrot,
  Apple,
  Milk,
  Flame,
  Wheat,
  Fish,
  Droplet,
  Sparkles,
  Leaf,
  Layers,
  CircleDot
} from 'lucide-react';

/**
 * Returns a sleek Lucide icon component for an ingredient category.
 */
export function getCategoryIcon(category, className = 'w-4 h-4') {
  const cat = String(category || '').toLowerCase();

  if (cat.includes('protein') || cat.includes('meat') || cat.includes('poultry')) {
    return <Beef className={className} size={16} />;
  }
  if (cat.includes('seafood') || cat.includes('fish')) {
    return <Fish className={className} size={16} />;
  }
  if (cat.includes('vegetable')) {
    return <Carrot className={className} size={16} />;
  }
  if (cat.includes('fruit')) {
    return <Apple className={className} size={16} />;
  }
  if (cat.includes('dairy') || cat.includes('egg') || cat.includes('cheese')) {
    return <Milk className={className} size={16} />;
  }
  if (cat.includes('grain') || cat.includes('flour') || cat.includes('bakery') || cat.includes('rice') || cat.includes('pasta')) {
    return <Wheat className={className} size={16} />;
  }
  if (cat.includes('spice') || cat.includes('seasoning') || cat.includes('pepper')) {
    return <Flame className={className} size={16} />;
  }
  if (cat.includes('oil') || cat.includes('fat')) {
    return <Droplet className={className} size={16} />;
  }
  if (cat.includes('herb') || cat.includes('aromatic')) {
    return <Leaf className={className} size={16} />;
  }
  if (cat.includes('pantry')) {
    return <Sparkles className={className} size={16} />;
  }
  if (cat.includes('legume') || cat.includes('bean') || cat.includes('dal') || cat.includes('nut')) {
    return <CircleDot className={className} size={16} />;
  }
  if (cat === 'all' || cat === '') {
    return <Layers className={className} size={16} />;
  }

  return <Utensils className={className} size={16} />;
}

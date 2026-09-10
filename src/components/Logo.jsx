import React from 'react';

/**
 * Rannabanna Signature Brand Logo
 * Features a pro-chef cast-iron skillet, radiant heat glow, rising steam wisps,
 * and a sizzling golden sunny-side-up egg with 3D specular highlight.
 *
 * Designed to replace raw text and emoji with a unified, iconic culinary mark.
 */
export default function Logo({ size = 'nav', className = '', showWordmark = false }) {
  // Map preset sizes or allow numeric values
  const sizeMap = {
    small: 36,
    nav: 46,
    footer: 52,
    large: 72
  };
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 46;

  return (
    <div 
      className={`rannabanna-brand-mark ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
        verticalAlign: 'middle'
      }}
      title="Rannabanna"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={pixelSize}
        height={pixelSize}
        className="rannabanna-logo-svg"
        role="img"
        aria-label="Rannabanna Logo"
        style={{
          display: 'block',
          overflow: 'visible',
          filter: 'drop-shadow(0 4px 12px rgba(255, 107, 53, 0.18))',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease'
        }}
      >
        <defs>
          {/* Cast-Iron Pan Gradients */}
          <linearGradient id="rbLogoPanGrad" x1="15%" y1="15%" x2="85%" y2="85%">
            <stop offset="0%" stopColor="#2D323F" />
            <stop offset="45%" stopColor="#1B1E26" />
            <stop offset="100%" stopColor="#111317" />
          </linearGradient>

          {/* Glowing Brand Sunset Rim */}
          <linearGradient id="rbLogoRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF7A3D" />
            <stop offset="50%" stopColor="#FF5722" />
            <stop offset="100%" stopColor="#E91E63" />
          </linearGradient>

          {/* Pan Handle Solid Steel */}
          <linearGradient id="rbLogoHandleGrad" x1="65%" y1="35%" x2="95%" y2="10%">
            <stop offset="0%" stopColor="#404654" />
            <stop offset="50%" stopColor="#282C37" />
            <stop offset="100%" stopColor="#181A20" />
          </linearGradient>

          {/* Golden Egg Yolk Gradient */}
          <linearGradient id="rbLogoYolkGrad" x1="35%" y1="30%" x2="75%" y2="85%">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="35%" stopColor="#FFB703" />
            <stop offset="75%" stopColor="#FB8500" />
            <stop offset="100%" stopColor="#E63946" />
          </linearGradient>

          {/* Sizzle Heat Radiance */}
          <radialGradient id="rbLogoHeatGlow" cx="46%" cy="54%" r="42%">
            <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.38" />
            <stop offset="60%" stopColor="#FF5722" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FF5722" stopOpacity="0" />
          </radialGradient>

          {/* Organic Depth Drop Shadows */}
          <filter id="rbLogoEggShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2.2" stdDeviation="1.8" floodColor="#000000" floodOpacity="0.55" />
          </filter>
          <filter id="rbLogoYolkShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="1.8" stdDeviation="1.4" floodColor="#7C2D12" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Ambient Sizzle Radiance */}
        <circle cx="46" cy="54" r="34" fill="url(#rbLogoHeatGlow)" />

        {/* Rising Culinary Steam Wisps with Shimmer */}
        <g className="rb-steam-group">
          <path
            className="rb-steam-1"
            d="M 37,23 C 35,16 41,12 38,5"
            stroke="#FFA726"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          <path
            className="rb-steam-2"
            d="M 47,20 C 49,12 45,8 48,3"
            stroke="#FF6B35"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          <path
            className="rb-steam-3"
            d="M 57,23 C 55,16 61,12 58,6"
            stroke="#FFCA28"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
        </g>

        {/* Skillet Handle (Ergonomic Chef Pro Handle with Hang Slot) */}
        <path
          d="M 68,36 L 87,17 C 89,15 92.5,16 93.5,18.5 C 94.5,21 93,24 91,26 L 72,44 Z"
          fill="url(#rbLogoHandleGrad)"
          stroke="#16181E"
          strokeWidth="0.8"
        />
        {/* Hanging Eyelet */}
        <circle cx="88.5" cy="20.5" r="2.4" fill="#0D1117" stroke="#404654" strokeWidth="0.7" />
        {/* Handle Grip Detail */}
        <line x1="77" y1="28" x2="81" y2="32" stroke="#4A5263" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        {/* Stamped 'R' Culinary Signature Monogram */}
        <text
          x="73"
          y="38"
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight="900"
          fontSize="5.5"
          fill="#FF8C42"
          opacity="0.85"
          textAnchor="middle"
          transform="rotate(45, 73, 38)"
        >
          R
        </text>

        {/* Skillet Outer Body & Brand Gradient Rim */}
        <circle
          cx="46"
          cy="54"
          r="30"
          fill="url(#rbLogoPanGrad)"
          stroke="url(#rbLogoRimGrad)"
          strokeWidth="3.2"
        />

        {/* Interior Cooking Surface & Seasoning Ring */}
        <circle cx="46" cy="54" r="25.5" fill="#14171E" stroke="#242936" strokeWidth="1.2" />
        <circle
          cx="46"
          cy="54"
          r="21"
          fill="none"
          stroke="#FF6B35"
          strokeWidth="0.6"
          strokeDasharray="1.5 3"
          opacity="0.25"
        />

        {/* Sizzling Egg White (Fluid, organic culinary shape) */}
        <path
          d="M 33,48 C 30,54 33,63 38,68 C 44,73 54,74 61,69 C 67,64 69,55 66,48 C 63,41 53,39 46,40 C 39,41 35,43 33,48 Z"
          fill="#F8FAFC"
          filter="url(#rbLogoEggShadow)"
        />
        {/* Crispy Golden Caramelized Sizzle Contour */}
        <path
          d="M 34,56 C 33,62 36,67 41,70 C 47,73 56,73 62,68"
          stroke="#F59E0B"
          strokeWidth="0.8"
          strokeDasharray="2 1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.65"
        />

        {/* Sizzling Egg Yolk (Plump, golden sunny-side sphere) */}
        <circle cx="49" cy="53" r="10.2" fill="url(#rbLogoYolkGrad)" filter="url(#rbLogoYolkShadow)" />

        {/* Yolk 3D Specular Curved Gloss Highlight */}
        <path
          d="M 44,49 C 45,46 48.5,44.5 51.5,45.5 C 49.5,46.5 47.5,47.8 46.5,50.8 C 45.5,51.8 44.2,51 44,49 Z"
          fill="#FFFFFF"
          opacity="0.95"
        />
        <circle cx="53.5" cy="56.5" r="1.3" fill="#FFFFFF" opacity="0.45" />

        {/* Pan Polished Edge Sparkle */}
        <path
          d="M 22,39 L 23.5,35 L 25,39 L 29,40.5 L 25,42 L 23.5,46 L 22,42 L 18,40.5 Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
      </svg>

      {/* Optional Wordmark (hidden by default as requested: "the whole word rannabanna is not necessary") */}
      {showWordmark && (
        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            background: 'var(--brand-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Rannabanna
        </span>
      )}
    </div>
  );
}

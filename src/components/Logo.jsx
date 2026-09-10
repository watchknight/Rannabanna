import React from 'react';

/**
 * Rannabanna Exact Brand Logo
 * Skillet with sizzling sunny-side-up egg and curved "RannaBanna" typography along the rim.
 * Matches user's exact specification.
 */
export default function Logo({ size = 'nav', className = '' }) {
  const heightMap = {
    small: 34,
    nav: 44,
    footer: 54,
    large: 76
  };
  const pixelHeight = typeof size === 'number' ? size : heightMap[size] || 44;
  const pixelWidth = Math.round(pixelHeight * (876 / 554));

  return (
    <div 
      className={`rannabanna-logo-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        userSelect: 'none'
      }}
      title="RannaBanna"
    >
      <img
        src="/rannabanna-logo.png"
        alt="RannaBanna"
        width={pixelWidth}
        height={pixelHeight}
        className="rannabanna-brand-img"
        style={{
          display: 'block',
          height: `${pixelHeight}px`,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease'
        }}
      />
    </div>
  );
}

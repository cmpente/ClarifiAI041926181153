import React from 'react';

export const PrismLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Prism Body - Isometric Triangle */}
      <path 
        d="M50 20L85 75H15L50 20Z" 
        fill="url(#prism-grad)" 
        stroke="currentColor" 
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path 
        d="M50 20V75L15 75L50 20Z" 
        fill="white" 
        fillOpacity="0.1"
      />
      
      {/* Messy Input Line (Left) */}
      <path 
        d="M2 55C10 45 5 65 15 55C20 45 25 65 35 55" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        className="opacity-40"
      >
        <animate 
          attributeName="stroke-dasharray" 
          from="0, 100" 
          to="100, 0" 
          dur="3s" 
          repeatCount="indefinite" 
        />
      </path>

      {/* Clean Output Lines (Right) */}
      <g className="text-emerald-400">
        <path d="M65 45H98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M68 55H98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M65 65H98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>

      <defs>
        <linearGradient id="prism-grad" x1="50" y1="20" x2="50" y2="75" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
    </svg>
  );
};

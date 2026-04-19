import React from 'react';

export const ClarifiLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg 
        viewBox="0 0 600 120" 
        className="w-full h-full" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ai-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4A90E2" /> {/* Cool steel blue */}
            <stop offset="100%" stopColor="#00E5FF" /> {/* Bright teal */}
          </linearGradient>
        </defs>

        {/* Main CLARIFI AI Text */}
        <text 
          x="300" 
          y="64" 
          dominantBaseline="middle" 
          textAnchor="middle" 
          fontSize="68"
          fontWeight="900"
          letterSpacing="0.05em"
          fontFamily="Montserrat, sans-serif"
        >
          <tspan fill="#FFFFFF">CLARIFI </tspan>
          <tspan fill="url(#ai-grad)">AI</tspan>
        </text>
      </svg>
    </div>
  );
};

import React from "react";

const LogoIcon = ({ size = 24, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Futuristic hexagonal base */}
      <path
        d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
        fill="url(#futuristicGradient)"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      
      {/* Stylized "UGC" letter */}
      <path
        d="M8 8V13C8 13.5523 8.44772 14 9 14H10.5C11.0523 14 11.5 13.5523 11.5 13V8"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      
      {/* Live streaming triangle */}
      <path
        d="M14 10.5L17 8.5V14.5L14 12.5V10.5Z"
        fill="white"
      />
      
      {/* Pulsing live dot with animated glow effect */}
      <circle cx="18" cy="6" r="1.2" fill="#FF3B30">
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
      </circle>
      
      {/* Digital wave elements */}
      <path
        d="M7 16.5H17"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeDasharray="1 1"
      />
      
      <path
        d="M9 18H15"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeDasharray="1 1"
      />
      
      {/* Holographic accent */}
      <path
        d="M12 5L14 6V7L12 8L10 7V6L12 5Z"
        fill="rgba(255,255,255,0.3)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.2"
      />
      
      <defs>
        <linearGradient id="futuristicGradient" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338CA" />
          <stop offset="0.5" stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default LogoIcon; 
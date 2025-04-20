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
      {/* Futuristic "U" shape with video play elements */}
      <path
        d="M5 7C5 5.34315 6.34315 4 8 4H16C17.6569 4 19 5.34315 19 7V14C19 15.6569 17.6569 17 16 17H8C6.34315 17 5 15.6569 5 14V7Z"
        fill="url(#gradient1)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Play button triangle */}
      <path
        d="M10 9L15 12L10 15V9Z"
        fill="currentColor"
      />
      {/* Live dot */}
      <circle cx="19" cy="7" r="2" fill="#FF3B30" />
      {/* Signal waves */}
      <path
        d="M3 12H2M22 12H21M5.5 18.5L4.5 19.5M18.5 18.5L19.5 19.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="gradient1" x1="5" y1="4" x2="19" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default LogoIcon; 
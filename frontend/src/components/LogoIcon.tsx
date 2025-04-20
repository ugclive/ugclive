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
      {/* Modern rounded square base */}
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="4"
        fill="url(#gradient1)"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* Stylized "UGC" text shape */}
      <path
        d="M7 8V13C7 14.1046 7.89543 15 9 15H11C12.1046 15 13 14.1046 13 13V8"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Live streaming element */}
      <path
        d="M15 11L18 9V15L15 13V11Z"
        fill="white"
      />
      
      {/* Live dot */}
      <circle cx="19" cy="6" r="1.5" fill="#FF3B30" />
      
      {/* Signal waves */}
      <path
        d="M14 17C15.3333 16.3333 17 16.8 17 18"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M15 19C16.3333 18.3333 18 18.8 18 20"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      
      <defs>
        <linearGradient id="gradient1" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default LogoIcon; 
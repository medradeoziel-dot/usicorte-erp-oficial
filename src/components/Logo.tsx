import React from 'react';

interface LogoProps {
  variant?: 'dark' | 'light' | 'print';
  withBackground?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Logo({ 
  variant = 'dark', 
  withBackground = false, 
  className = 'h-12 w-auto',
  style 
}: LogoProps) {
  // Color mapping:
  // dark: White "Usi", Red "corte", White "Metais" (for dark backgrounds)
  // light/print: Dark "#1e293b" or "#000000" "Usi", Red "#ff0000" "corte", Dark "Metais" (for light backgrounds)
  const textColor = variant === 'dark' ? '#ffffff' : '#111827';
  const redColor = '#ff0000';

  return (
    <svg 
      viewBox="0 0 540 210" 
      width="100%" 
      height="auto" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&display=swap');
          .font-usicorte-text {
            font-family: 'Comfortaa', 'Arial Rounded MT Bold', 'Fredoka', 'Quicksand', 'Montserrat', sans-serif;
            font-weight: 700;
          }
        `}</style>
      </defs>

      {withBackground && (
        <rect width="540" height="210" rx="16" fill="#000000" />
      )}

      <g className="font-usicorte-text" fontSize="84">
        {/* Top Row: Usi (White/Dark) + corte (Red) */}
        <text x="20" y="102" fill={textColor}>Usi</text>
        <text x="175" y="102" fill={redColor}>corte</text>

        {/* Bottom Row: Metais (White/Dark, aligned below 'corte') */}
        <text x="175" y="182" fill={textColor}>Metais</text>
      </g>
    </svg>
  );
}

// Function to generate raw SVG string for embedding in reports, dynamic print views, base64 data URIs
export function getLogoSvgString(variant: 'dark' | 'light' = 'light'): string {
  const textColor = variant === 'dark' ? '#ffffff' : '#111827';
  const redColor = '#ff0000';

  return `<svg viewBox="0 0 540 210" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="background: transparent;">
    <defs>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&display=swap');
        .font-usicorte-text {
          font-family: 'Comfortaa', 'Arial Rounded MT Bold', 'Fredoka', 'Quicksand', 'Montserrat', sans-serif;
          font-weight: 700;
        }
      </style>
    </defs>
    <g class="font-usicorte-text" font-size="84">
      <text x="20" y="102" fill="${textColor}">Usi</text>
      <text x="175" y="102" fill="${redColor}">corte</text>
      <text x="175" y="182" fill="${textColor}">Metais</text>
    </g>
  </svg>`;
}

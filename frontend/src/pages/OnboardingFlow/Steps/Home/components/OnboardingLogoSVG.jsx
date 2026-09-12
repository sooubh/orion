import { useTheme } from "@/hooks/useTheme";

export function OnboardingLogoSVG() {
  const { isLight } = useTheme();
  return (
    <svg
      viewBox="0 0 800 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      <defs>
        <linearGradient
          id="orion_glow"
          x1="100"
          y1="50"
          x2="700"
          y2="450"
          gradientUnits="userSpaceOnUse"
        >
          {isLight ? (
            <>
              <stop stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="0.5" stopColor="#38bdf8" stopOpacity="0.15" />
              <stop offset="1" stopColor="#0369a1" stopOpacity="0.25" />
            </>
          ) : (
            <>
              <stop stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="0.5" stopColor="#0284c7" stopOpacity="0.15" />
              <stop offset="1" stopColor="#0f172a" stopOpacity="0.3" />
            </>
          )}
        </linearGradient>
      </defs>

      {/* Constellation Major Connecting Vectors */}
      <g stroke="url(#orion_glow)" strokeWidth="3" strokeDasharray="4 6">
        {/* Betelgeuse to Belt */}
        <line x1="220" y1="120" x2="350" y2="260" />
        {/* Bellatrix to Belt */}
        <line x1="580" y1="140" x2="450" y2="240" />
        {/* Belt to Saiph */}
        <line x1="350" y1="260" x2="240" y2="400" />
        {/* Belt to Rigel */}
        <line x1="450" y1="240" x2="560" y2="380" />
        {/* Belt Connection */}
        <line x1="350" y1="260" x2="400" y2="250" />
        <line x1="400" y1="250" x2="450" y2="240" />
        {/* Cross Shoulder / Knee Links */}
        <line x1="220" y1="120" x2="580" y2="140" />
        <line x1="240" y1="400" x2="560" y2="380" />
      </g>

      {/* Center Glowing Cluster Halo */}
      <circle cx="400" cy="250" r="140" fill="url(#orion_glow)" filter="blur(40px)" />

      {/* Major Stars */}
      {/* Betelgeuse (Alpha Orionis) */}
      <circle cx="220" cy="120" r="16" fill={isLight ? "#0284c7" : "#38bdf8"} fillOpacity="0.8" />
      <circle cx="220" cy="120" r="26" stroke={isLight ? "#0284c7" : "#38bdf8"} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Bellatrix (Gamma Orionis) */}
      <circle cx="580" cy="140" r="13" fill={isLight ? "#0284c7" : "#38bdf8"} fillOpacity="0.75" />
      <circle cx="580" cy="140" r="22" stroke={isLight ? "#0284c7" : "#38bdf8"} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Saiph (Kappa Orionis) */}
      <circle cx="240" cy="400" r="13" fill={isLight ? "#0284c7" : "#38bdf8"} fillOpacity="0.75" />
      <circle cx="240" cy="400" r="22" stroke={isLight ? "#0284c7" : "#38bdf8"} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Rigel (Beta Orionis) */}
      <circle cx="560" cy="380" r="17" fill={isLight ? "#0284c7" : "#38bdf8"} fillOpacity="0.85" />
      <circle cx="560" cy="380" r="28" stroke={isLight ? "#0284c7" : "#38bdf8"} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Orion's Belt (Alnitak, Alnilam, Mintaka) */}
      <circle cx="350" cy="260" r="11" fill="#e0f2fe" fillOpacity="0.9" />
      <circle cx="400" cy="250" r="14" fill="#38bdf8" fillOpacity="0.95" />
      <circle cx="450" cy="240" r="11" fill="#e0f2fe" fillOpacity="0.9" />
    </svg>
  );
}

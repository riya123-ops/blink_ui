/** Screen1 light theme: blue waves left, green waves right, dot grid. */
export function ThemeBackground() {
  return (
    <div className="theme-bg" aria-hidden="true">
      <svg className="theme-bg-waves" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="waveBlueA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.46" />
            <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="waveBlueB" x1="0.2" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="waveBlueC" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="waveGreenA" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.42" />
            <stop offset="50%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#86efac" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="waveGreenB" x1="1" y1="0.2" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="waveGreenC" x1="0.8" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#bbf7d0" stopOpacity="0.12" />
          </linearGradient>
          <filter id="waveSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="waveSofter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="26" />
          </filter>
        </defs>

        <g filter="url(#waveSofter)">
          <path
            fill="url(#waveBlueA)"
            d="M-80 430 C 120 360, 260 520, 390 470 C 540 410, 620 620, 480 710 C 300 830, 80 780, -40 690 Z"
          />
        </g>
        <g filter="url(#waveSoft)">
          <path
            fill="url(#waveBlueB)"
            d="M-60 560 C 160 500, 300 640, 430 600 C 560 560, 520 760, 300 820 C 90 880, -20 740, -60 560 Z"
          />
          <path
            fill="url(#waveBlueC)"
            d="M-40 640 C 180 600, 340 720, 460 690 C 580 660, 500 840, 240 880 C 40 920, -50 780, -40 640 Z"
          />
        </g>

        <g filter="url(#waveSofter)">
          <path
            fill="url(#waveGreenA)"
            d="M1520 280 C 1280 240, 1180 420, 1060 380 C 900 330, 860 560, 1020 640 C 1220 740, 1460 680, 1540 520 Z"
          />
        </g>
        <g filter="url(#waveSoft)">
          <path
            fill="url(#waveGreenB)"
            d="M1540 420 C 1300 380, 1160 540, 1040 510 C 900 470, 920 700, 1140 760 C 1340 820, 1540 720, 1540 420 Z"
          />
          <path
            fill="url(#waveGreenC)"
            d="M1520 560 C 1280 530, 1140 680, 1020 650 C 880 610, 960 820, 1200 860 C 1400 900, 1540 780, 1520 560 Z"
          />
        </g>
      </svg>
      <div className="theme-bg-dots" />
      <div className="theme-bg-grain" />
    </div>
  )
}

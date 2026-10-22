import React from 'react'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'icon' | 'full'
  className?: string
  animated?: boolean
}

const sizeMap = {
  xs: { icon: 20, text: 'text-[13px]', subtext: 'text-[8px]' },
  sm: { icon: 26, text: 'text-[15px]', subtext: 'text-[9px]' },
  md: { icon: 34, text: 'text-[18px]', subtext: 'text-[10px]' },
  lg: { icon: 44, text: 'text-[22px]', subtext: 'text-[11px]' },
  xl: { icon: 60, text: 'text-[28px]', subtext: 'text-[13px]' },
}

export function LogoEmblem({ size = 32, animated = false, className = '' }: { size?: number; animated?: boolean; className?: string }) {
  const idPrefix = React.useId()
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full drop-shadow-[0_0_12px_rgba(6,182,212,0.4)] ${animated ? 'hover:scale-105 transition-transform duration-300' : ''}`}
      >
        <defs>
          <linearGradient id={`${idPrefix}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="45%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c172a" />
            <stop offset="100%" stopColor="#040811" />
          </linearGradient>
          <filter id={`${idPrefix}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hex-Shield Shell */}
        <path
          d="M32 4 L56 14 V28 C56 44 46 54 32 60 C18 54 8 44 8 28 V14 Z"
          fill={`url(#${idPrefix}-bg)`}
          stroke={`url(#${idPrefix}-grad)`}
          strokeWidth="2.75"
          strokeLinejoin="round"
        />

        {/* Circuit Telemetry Grid */}
        <path
          d="M32 16 L44 26 V38 L32 48 L20 38 V26 Z"
          stroke="#06b6d4"
          strokeWidth="1.25"
          strokeOpacity="0.55"
          strokeDasharray="2.5 2"
          fill="none"
        />

        {/* Central Core Anomaly Shield */}
        <path
          d="M32 20 L40 28 L32 38 L24 28 Z"
          fill={`url(#${idPrefix}-grad)`}
          filter={`url(#${idPrefix}-glow)`}
          className={animated ? 'animate-pulse' : ''}
        />

        {/* Satellite Agent Nodes */}
        <circle cx="32" cy="14" r="2.2" fill="#00f2fe" />
        <circle cx="48" cy="22" r="1.8" fill="#10b981" />
        <circle cx="16" cy="22" r="1.8" fill="#10b981" />
        <circle cx="32" cy="52" r="2.2" fill="#10b981" />
      </svg>
    </div>
  )
}

export default function Logo({
  size = 'md',
  variant = 'full',
  className = '',
  animated = true,
}: LogoProps) {
  const config = sizeMap[size]

  if (variant === 'icon') {
    return <LogoEmblem size={config.icon} animated={animated} className={className} />
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <LogoEmblem size={config.icon} animated={animated} />
      <div className="flex flex-col leading-none">
        <div className={`font-bold tracking-[0.14em] text-white flex items-center ${config.text}`}>
          <span>AGENT</span>
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            SHIELD
          </span>
          <span className="ml-1 text-[10px] px-1 py-0.2 rounded font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            AI
          </span>
        </div>
        <span className={`font-mono font-medium tracking-[0.24em] text-cyan-400/80 mt-0.5 uppercase ${config.subtext}`}>
          Runtime Defense
        </span>
      </div>
    </div>
  )
}

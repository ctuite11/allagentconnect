import React from 'react';

/**
 * Subtle network sphere animation for homepage hero
 * Cloudflare-inspired, infrastructure feel
 * Desktop only, purely decorative
 */

// Toggle this to true for placement/sizing assessment
const DEBUG_VISIBLE = false;

// Brand colors
const LINE_COLOR = '#059669'; // emerald-600
const DOT_COLOR = '#94A3B8';  // slate-400 (matches "Connect" in logo)

const NetworkGlobe = () => {
  // Generate network nodes in a spherical distribution
  const nodes = React.useMemo(() => {
    const points: { x: number; y: number; z: number }[] = [];
    const count = 24;
    
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      
      points.push({
        x: 150 + 120 * Math.cos(theta) * Math.sin(phi),
        y: 150 + 120 * Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi)
      });
    }
    return points;
  }, []);

  // Generate connections between nearby nodes
  const connections = React.useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) + 
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        
          if (dist < 100) {
          lines.push({
            x1: nodes[i].x,
            y1: nodes[i].y,
            x2: nodes[j].x,
            y2: nodes[j].y,
            // Keep a minimum visibility so we don't get "faded" near-threshold lines
            opacity: DEBUG_VISIBLE ? 0.5 : 0.25 + (1 - dist / 100) * 0.75
          });
        }
      }
    }
    return lines;
  }, [nodes]);

  // Debug vs production styles
  const svgOpacity = DEBUG_VISIBLE ? 0.55 : 1;
  const lineStrokeWidth = DEBUG_VISIBLE ? 1.5 : 2;
  const ringStrokeWidth = DEBUG_VISIBLE ? 1 : 1.5;
  const nodeRadius = DEBUG_VISIBLE ? { large: 4, small: 3 } : { large: 4, small: 3.5 };

  return (
    <div 
      className="absolute inset-0 hidden md:block overflow-hidden pointer-events-none"
      aria-hidden="true"
      style={DEBUG_VISIBLE ? { zIndex: 20 } : { zIndex: 2 }}
    >
      
      {/* Network sphere */}
      <div 
        className="absolute right-4 lg:right-10 top-1/2 -translate-y-1/2 w-[550px] h-[550px]"
        style={{
          transform: 'translateY(-50%) rotateX(15deg) rotateY(-10deg)',
          transformStyle: 'preserve-3d',
          perspective: '1000px'
        }}
      >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{
            animation: 'networkSpin 35s linear infinite',
            opacity: svgOpacity
          }}
        >
          {/* Glow filter and gradient for shooting star tail */}
          <defs>
            <filter id="starGlow" x="-200%" y="-100%" width="400%" height="300%">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="tailGradient1" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0"/>
              <stop offset="30%" stopColor="white" stopOpacity="0.2"/>
              <stop offset="60%" stopColor="white" stopOpacity="0.5"/>
              <stop offset="85%" stopColor="white" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="white" stopOpacity="1"/>
            </linearGradient>
            <linearGradient id="tailGradient2" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0"/>
              <stop offset="30%" stopColor="white" stopOpacity="0.2"/>
              <stop offset="60%" stopColor="white" stopOpacity="0.5"/>
              <stop offset="85%" stopColor="white" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="white" stopOpacity="1"/>
            </linearGradient>
          </defs>
          
          {/* Connection lines */}
          {connections.map((line, i) => (
            <line
              key={`line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={LINE_COLOR}
              strokeWidth={lineStrokeWidth}
              opacity={line.opacity}
            />
          ))}
          
          {/* Nodes */}
          {nodes.map((node, i) => (
            <circle
              key={`node-${i}`}
              cx={node.x}
              cy={node.y}
              r={node.z > 0 ? nodeRadius.large : nodeRadius.small}
              fill={DOT_COLOR}
              opacity={1}
            />
          ))}
          
          {/* Subtle orbital rings */}
          <ellipse
            cx="150"
            cy="150"
            rx="120"
            ry="40"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={DEBUG_VISIBLE ? 0.5 : 0.8}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={DEBUG_VISIBLE ? 0.4 : 0.7}
          />
          
          {/* Shooting star on horizontal ellipse with tail */}
          <g>
            {/* Tail */}
            <line x1="0" y1="0" x2="-70" y2="0" stroke="url(#tailGradient1)" strokeWidth="2.5" strokeLinecap="round">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                begin="0s; 8s"
                path="M30,150 A120,40 0 1,0 270,150 A120,40 0 1,0 30,150"
                rotate="auto"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0.8;0;0"
                keyTimes="0;0.05;0.4;0.45;0.5;1"
                dur="8s"
                repeatCount="indefinite"
              />
            </line>
            {/* Head */}
            <circle r="3" fill="white" filter="url(#starGlow)">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                begin="0s; 8s"
                path="M30,150 A120,40 0 1,0 270,150 A120,40 0 1,0 30,150"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0.8;0;0"
                keyTimes="0;0.05;0.4;0.45;0.5;1"
                dur="8s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
          
          {/* Shooting star on circular ring with tail */}
          <g>
            {/* Tail */}
            <line x1="0" y1="0" x2="-70" y2="0" stroke="url(#tailGradient2)" strokeWidth="2.5" strokeLinecap="round">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                begin="4s; 12s"
                path="M50,150 A100,100 0 1,0 250,150 A100,100 0 1,0 50,150"
                rotate="auto"
              />
              <animate
                attributeName="opacity"
                values="0;0;1;1;0.8;0"
                keyTimes="0;0.5;0.55;0.9;0.95;1"
                dur="8s"
                repeatCount="indefinite"
              />
            </line>
            {/* Head */}
            <circle r="3" fill="white" filter="url(#starGlow)">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                begin="4s; 12s"
                path="M50,150 A100,100 0 1,0 250,150 A100,100 0 1,0 50,150"
              />
              <animate
                attributeName="opacity"
                values="0;0;1;1;0.8;0"
                keyTimes="0;0.5;0.55;0.9;0.95;1"
                dur="8s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </svg>
      </div>
      
      {/* CSS for rotation animation */}
      <style>{`
        @keyframes networkSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NetworkGlobe;

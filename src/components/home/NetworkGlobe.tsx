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
const DOT_COLOR = '#6B7280';  // gray-500

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
            opacity: DEBUG_VISIBLE ? 0.5 : (1 - dist / 100) * 0.6
          });
        }
      }
    }
    return lines;
  }, [nodes]);

  // Debug vs production styles
  const svgOpacity = DEBUG_VISIBLE ? 0.55 : 0.7;
  const lineStrokeWidth = DEBUG_VISIBLE ? 1.5 : 1.5;
  const ringStrokeWidth = DEBUG_VISIBLE ? 1 : 1;
  const nodeRadius = DEBUG_VISIBLE ? { large: 4, small: 3 } : { large: 3, small: 2.5 };

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
          {/* Glow filter for shooting star */}
          <defs>
            <filter id="starGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
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
              opacity={DEBUG_VISIBLE ? 0.7 : 0.6 + node.z * 0.3}
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
            opacity={DEBUG_VISIBLE ? 0.5 : 0.5}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={DEBUG_VISIBLE ? 0.4 : 0.4}
          />
          
          {/* Shooting star on horizontal ellipse - visible first 4s of 8s cycle */}
          <circle r="4" fill="white" filter="url(#starGlow)">
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
          
          {/* Shooting star on circular ring - visible second 4s of 8s cycle */}
          <circle r="4" fill="white" filter="url(#starGlow)">
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

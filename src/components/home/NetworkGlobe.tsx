import React from 'react';

/**
 * Subtle network sphere animation for homepage hero
 * Calm, ambient, infrastructure feel
 * Supports two variants:
 * - "hero" (default): Home page positioning, full effects + rare sparks
 * - "ambient": Centered, smaller, no pulse, slower rotation, desaturated
 */

// Toggle this to true for placement/sizing assessment
const DEBUG_VISIBLE = false;

// Brand colors - LOCKED to single AAC Blue
const LINE_COLOR = '#0E56F5'; // AAC Blue (HSL 221 92% 51%)
const NODE_COLOR = '#CBD5E1';  // slate-300 (true silver, more luminance)

interface NetworkGlobeProps {
  variant?: 'hero' | 'ambient' | 'static';
  strokeColor?: string;
}

const NetworkGlobe = ({ variant = 'hero', strokeColor }: NetworkGlobeProps) => {
  const isAmbient = variant === 'ambient';
  const isStatic = variant === 'static';
  
  // Use provided strokeColor or default brand colors
  const lineColor = strokeColor || LINE_COLOR;
  const nodeColor = strokeColor || NODE_COLOR;
  
  // State for rare "thought spark" effect (hero mode only)
  const [sparkingNode, setSparkingNode] = React.useState<number | null>(null);
  const sparkTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const clearSparkRef = React.useRef<NodeJS.Timeout | null>(null);
  
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

  // Generate connections between nearby nodes with z-based depth opacity
  // Crisp depth contrast: back ~0.05, front ~0.18
  const connections = React.useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number; avgZ: number }[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) + 
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        
        if (dist < 100) {
          // Z-based depth: avgZ in [-1, 1] → opacity 0.04..0.18 (crisp contrast)
          const avgZ = (nodes[i].z + nodes[j].z) / 2;
          const t = (avgZ + 1) / 2; // normalize to 0..1
          const depthOpacity = 0.04 + t * 0.14; // back ~0.04, front ~0.18
          
          lines.push({
            x1: nodes[i].x,
            y1: nodes[i].y,
            x2: nodes[j].x,
            y2: nodes[j].y,
            opacity: depthOpacity,
            avgZ: avgZ
          });
        }
      }
    }
    return lines;
  }, [nodes]);
  
  // Node opacity: silvery and present for structure (0.22-0.28)
  const getNodeOpacity = (z: number) => {
    const t = (z + 1) / 2; // normalize to 0..1
    return 0.22 + t * 0.06; // range 0.22 to 0.28
  };

  // Front-line boost: top 10-14% of connections get +0.06 opacity for "wow"
  const sortedByZ = [...connections].sort((a, b) => b.avgZ - a.avgZ);
  const frontLineCount = Math.ceil(connections.length * 0.12); // ~12%
  const frontLineSet = new Set(sortedByZ.slice(0, frontLineCount));
  
  const getLineOpacity = (line: typeof connections[0]) => {
    if (frontLineSet.has(line)) {
      return Math.min(line.opacity + 0.06, 0.24); // boost, cap at 0.24
    }
    return line.opacity;
  };
  
  const getLineStrokeWidth = (line: typeof connections[0], baseWidth: number) => {
    if (frontLineSet.has(line)) {
      return Math.min(baseWidth + 0.25, 2.0); // boost, cap at 2.0
    }
    return baseWidth;
  };

  // Front-most nodes eligible for sparking (z > 0.45)
  const frontNodeIndices = React.useMemo(() => {
    return nodes
      .map((n, i) => ({ z: n.z, index: i }))
      .filter(n => n.z > 0.45)
      .map(n => n.index);
  }, [nodes]);
  
  // "Thought spark" effect - fires every 2.8-6s, more frequent + brighter (hero mode only)
  React.useEffect(() => {
    if (isAmbient || isStatic || frontNodeIndices.length === 0) return;
    
    let cancelled = false;
    const timers: number[] = [];
    
    const triggerSpark = () => {
      if (cancelled) return;
      
      // Pick random front-most node
      const chosen = frontNodeIndices[Math.floor(Math.random() * frontNodeIndices.length)];
      setSparkingNode(chosen);
      
      // Clear spark after 220ms (sharp pop)
      timers.push(window.setTimeout(() => {
        if (!cancelled) setSparkingNode(null);
      }, 220));
      
      // More frequent: every ~2.8-6s
      const nextDelay = 2800 + Math.random() * 3200;
      timers.push(window.setTimeout(triggerSpark, nextDelay));
    };
    
    // First spark sooner (1.2s)
    timers.push(window.setTimeout(triggerSpark, 1200));
    
    // Cleanup all timers on unmount
    return () => {
      cancelled = true;
      timers.forEach(t => clearTimeout(t));
    };
  }, [isAmbient, isStatic, frontNodeIndices]);

  // Crisp structural stroke weights
  const lineStrokeWidth = 1.75;
  const ringStrokeWidth = 1.5;
  const nodeRadius = { large: 3.5, small: 3 };

  // Ambient mode: slower rotation only
  const rotationSpeed = isAmbient ? '14s' : '90s';

  // Static mode: no animation, supports color inheritance via strokeColor prop
  if (isStatic) {
    return (
      <div 
        className="w-full h-full pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
        >
          {/* Connection lines */}
          {connections.map((line, i) => (
            <line
              key={`line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={strokeColor ? 'currentColor' : lineColor}
              strokeWidth={lineStrokeWidth}
              opacity={line.opacity}
            />
          ))}
          
          {/* Nodes - static, no pulse */}
          {nodes.map((node, i) => {
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            return (
              <circle
                key={`node-${i}`}
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={strokeColor ? 'currentColor' : nodeColor}
                opacity={1}
              />
            );
          })}
          
          {/* Subtle orbital rings */}
          <ellipse
            cx="150"
            cy="150"
            rx="120"
            ry="40"
            fill="none"
            stroke={strokeColor ? 'currentColor' : lineColor}
            strokeWidth={ringStrokeWidth}
            opacity={1}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={strokeColor ? 'currentColor' : lineColor}
            strokeWidth={ringStrokeWidth}
            opacity={1}
          />
        </svg>
      </div>
    );
  }

  // Hero mode: absolute positioned, desktop only
  // Ambient mode: relative, centered, all breakpoints
  if (isAmbient) {
    return (
      <div 
        className="w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{
            animation: `networkSpin ${rotationSpeed} linear infinite`,
            opacity: 1
          }}
        >
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
          
          {/* Nodes - no pulse in ambient mode */}
          {nodes.map((node, i) => {
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            return (
              <circle
                key={`node-${i}`}
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={NODE_COLOR}
                opacity={1}
              />
            );
          })}
          
          {/* Subtle orbital rings */}
          <ellipse
            cx="150"
            cy="150"
            rx="120"
            ry="40"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={1}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={1}
          />
        </svg>
        
        <style>{`
          @keyframes networkSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Hero mode - fixed-size artifact; positioning handled by parent in Home.tsx
  return (
    <div 
      className="hidden md:block w-[700px] h-[700px] lg:w-[900px] lg:h-[900px] overflow-visible pointer-events-none"
      aria-hidden="true"
      style={{
        transform: 'rotateX(15deg) rotateY(-10deg)',
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        willChange: 'transform',
        // Ultra-gentle mask: prevents harsh edge without "cut off" feel
        maskImage:
          'radial-gradient(circle at 92% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.85) 94%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:
          'radial-gradient(circle at 92% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 88%, rgba(0,0,0,0.85) 94%, rgba(0,0,0,0) 100%)',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat'
      }}
    >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{
            animation: 'networkSpin 60s linear infinite',
            transformOrigin: 'center',
            transformBox: 'fill-box'
          }}
        >
          {/* Connection lines - crisp depth contrast with front-line boost */}
          {connections.map((line, i) => (
            <line
              key={`line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={LINE_COLOR}
              strokeWidth={getLineStrokeWidth(line, lineStrokeWidth)}
              opacity={getLineOpacity(line)}
            />
          ))}
          
          {/* Nodes with depth-aware opacity + bright spark effect */}
          {nodes.map((node, i) => {
            const isSparking = sparkingNode === i;
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            const baseOpacity = getNodeOpacity(node.z);
            
            return (
              <g key={`node-${i}`}>
                {/* Halo bloom (blurred) */}
                {isSparking && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius * 2.3}
                    fill={LINE_COLOR}
                    opacity={0.35}
                    style={{ filter: 'blur(7px)' }}
                  />
                )}
                {/* Spark core: white flash + blue glow */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSparking ? radius * 1.35 : radius}
                  fill={isSparking ? '#FFFFFF' : NODE_COLOR}
                  opacity={isSparking ? 0.98 : baseOpacity}
                  style={{
                    filter: isSparking
                      ? 'drop-shadow(0 0 10px rgba(14,86,245,0.6)) drop-shadow(0 0 18px rgba(14,86,245,0.35))'
                      : 'none'
                  }}
                />
              </g>
            );
          })}
          
          {/* Subtle orbital rings - atmospheric opacity */}
          <ellipse
            cx="150"
            cy="150"
            rx="120"
            ry="40"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={0.10}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={0.10}
          />
        </svg>
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

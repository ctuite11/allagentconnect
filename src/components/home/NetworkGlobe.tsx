import React from 'react';

/**
 * Subtle network sphere animation for homepage hero
 * Calm, ambient, infrastructure feel
 * Supports two variants:
 * - "hero" (default): Home page positioning, full effects
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
  
  // Track which nodes have slow breathing animation (hero mode only)
  // We select the front-most 5 nodes by z-value for subtle activity
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

  // Identify front-most nodes for slow breathing effect (hero mode only)
  // Pick top 5 nodes by z-value (roughly top 20%)
  const breathingNodeIndices = React.useMemo(() => {
    if (isAmbient || isStatic) return new Set<number>();
    const indexed = nodes.map((n, i) => ({ z: n.z, index: i }));
    indexed.sort((a, b) => b.z - a.z);
    return new Set(indexed.slice(0, 5).map(n => n.index));
  }, [nodes, isAmbient, isStatic]);

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

  // Hero mode - atmospheric backplate behind content
  return (
    <div 
      className="absolute inset-0 hidden md:block overflow-visible pointer-events-none"
      aria-hidden="true"
      style={{ 
        zIndex: DEBUG_VISIBLE ? 20 : 1,
        // Radial mask: strongest at right/center (70% 45%), fades to transparent at edges
        maskImage: 'radial-gradient(circle at 70% 45%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0) 78%)',
        WebkitMaskImage: 'radial-gradient(circle at 70% 45%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0) 78%)'
      }}
    >
      
      {/* Network sphere - large atmospheric backplate */}
      <div 
        className="absolute right-0 lg:right-6 top-1/2 w-[700px] h-[700px] lg:w-[900px] lg:h-[900px]"
        style={{
          transform: 'translateY(-40%) rotateX(15deg) rotateY(-10deg)',
          transformStyle: 'preserve-3d',
          perspective: '1000px'
        }}
      >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{
            animation: 'networkSpin 60s linear infinite'
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
          
          {/* Nodes with depth-aware opacity + micro-halos on front-most */}
          {nodes.map((node, i) => {
            const isBreathing = breathingNodeIndices.has(i);
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            const nodeOpacity = getNodeOpacity(node.z);
            // Micro-halo for front-most nodes (z > 0.65, roughly top 8%)
            const showHalo = node.z > 0.65;
            
            return (
              <g key={`node-${i}`}>
                {/* Micro-halo behind front-most nodes */}
                {showHalo && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 3}
                    fill={LINE_COLOR}
                    opacity={0.07}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={NODE_COLOR}
                  opacity={nodeOpacity}
                  style={isBreathing ? {
                    animation: 'nodeBreathe 9s ease-in-out infinite',
                    animationDelay: `${i * 0.5}s`
                  } : undefined}
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
      </div>
      
      {/* CSS for rotation + breathing animations */}
      <style>{`
        @keyframes networkSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes nodeBreathe {
          0%, 100% { opacity: 0.22; }
          50% { opacity: 0.28; }
        }
      `}</style>
    </div>
  );
};

export default NetworkGlobe;

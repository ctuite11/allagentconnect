import React from 'react';

/**
 * Neutral architectural network globe for homepage hero
 * Reads as subtle infrastructure / watermark background
 * NOT a tech feature - must recede behind content
 */

// Neutral gray colors - darker for visibility on white
const LINE_COLOR = '#A1A1AA'; // zinc-400
const NODE_COLOR = '#D4D4D8'; // zinc-300

interface NetworkGlobeProps {
  variant?: 'hero' | 'ambient' | 'static';
  strokeColor?: string;
}

const NetworkGlobe = ({ variant = 'hero', strokeColor }: NetworkGlobeProps) => {
  const isAmbient = variant === 'ambient';
  const isStatic = variant === 'static';
  
  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  
  // Use provided strokeColor or default neutral colors
  const lineColor = strokeColor || LINE_COLOR;
  const nodeColor = strokeColor || NODE_COLOR;
  
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
    const lines: { x1: number; y1: number; x2: number; y2: number; avgZ: number }[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) + 
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        
        if (dist < 100) {
          const avgZ = (nodes[i].z + nodes[j].z) / 2;
          lines.push({
            x1: nodes[i].x,
            y1: nodes[i].y,
            x2: nodes[j].x,
            y2: nodes[j].y,
            avgZ
          });
        }
      }
    }
    return lines;
  }, [nodes]);
  
  // Simple depth fade for lines: back ~0.35, front ~0.65
  const getLineOpacity = (z: number) => {
    const t = (z + 1) / 2; // normalize to 0..1
    return 0.35 + t * 0.30;
  };
  
  // Simple depth fade for nodes: back ~0.45, front ~0.80
  const getNodeOpacity = (z: number) => {
    const t = (z + 1) / 2; // normalize to 0..1
    return 0.45 + t * 0.35;
  };

  // Thinner stroke weights for subtlety
  const lineStrokeWidth = 1.0;
  const ringStrokeWidth = 0.75;
  const nodeRadius = { large: 2.5, small: 2.0 };

  // Static mode: no animation
  if (isStatic || prefersReducedMotion) {
    return (
      <div 
        className="w-full h-full pointer-events-none flex items-center justify-center"
        aria-hidden="true"
        style={{ opacity: 0.08 }}
      >
        <svg viewBox="0 0 300 300" className="w-full h-full">
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
              opacity={getLineOpacity(line.avgZ)}
            />
          ))}
          
          {/* Nodes */}
          {nodes.map((node, i) => {
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            return (
              <circle
                key={`node-${i}`}
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={strokeColor ? 'currentColor' : nodeColor}
                opacity={getNodeOpacity(node.z)}
              />
            );
          })}
          
          {/* Subtle orbital rings */}
          <ellipse
            cx="150" cy="150" rx="120" ry="40"
            fill="none"
            stroke={strokeColor ? 'currentColor' : lineColor}
            strokeWidth={ringStrokeWidth}
            opacity={0.4}
          />
          <ellipse
            cx="150" cy="150" rx="100" ry="100"
            fill="none"
            stroke={strokeColor ? 'currentColor' : lineColor}
            strokeWidth={ringStrokeWidth}
            opacity={0.4}
          />
        </svg>
      </div>
    );
  }

  // Ambient mode: centered, all breakpoints
  if (isAmbient) {
    return (
      <div 
        className="w-full h-full pointer-events-none"
        aria-hidden="true"
        style={{ opacity: 0.08 }}
      >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{ animation: 'networkSpin 60s linear infinite' }}
        >
          {connections.map((line, i) => (
            <line
              key={`line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={LINE_COLOR}
              strokeWidth={lineStrokeWidth}
              opacity={getLineOpacity(line.avgZ)}
            />
          ))}
          
          {nodes.map((node, i) => {
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            return (
              <circle
                key={`node-${i}`}
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={NODE_COLOR}
                opacity={getNodeOpacity(node.z)}
              />
            );
          })}
          
          <ellipse
            cx="150" cy="150" rx="120" ry="40"
            fill="none" stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth} opacity={0.4}
          />
          <ellipse
            cx="150" cy="150" rx="100" ry="100"
            fill="none" stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth} opacity={0.4}
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

  // Hero mode - fixed-size, subtle architectural background
  return (
    <div 
      className="hidden md:block w-[700px] h-[700px] lg:w-[900px] lg:h-[900px] overflow-visible pointer-events-none relative"
      aria-hidden="true"
    >
      {/* Radial blue glow - emanates from globe center, not a side gradient */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: `
            radial-gradient(circle at 60% 52%,
              rgba(14,86,245,0.38) 0%,
              rgba(14,86,245,0.18) 10%,
              rgba(14,86,245,0.08) 18%,
              rgba(14,86,245,0.00) 30%),
            radial-gradient(circle at 60% 52%,
              rgba(14,86,245,0.10) 0%,
              rgba(14,86,245,0.05) 22%,
              rgba(14,86,245,0.00) 48%)
          `,
          mixBlendMode: 'multiply',
          WebkitMaskImage: `
            radial-gradient(circle at 60% 52%,
              rgba(0,0,0,1) 0%,
              rgba(0,0,0,1) 52%,
              rgba(0,0,0,0) 60%)
          `,
          maskImage: `
            radial-gradient(circle at 60% 52%,
              rgba(0,0,0,1) 0%,
              rgba(0,0,0,1) 52%,
              rgba(0,0,0,0) 60%)
          `,
        }}
      />
      {/* Globe container with reduced opacity */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.28,
          transform: 'rotateX(8deg)',
          willChange: 'transform',
          maskImage: 'radial-gradient(circle at 75% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'radial-gradient(circle at 75% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%)',
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
        {/* Connection lines with simple depth fade */}
        {connections.map((line, i) => (
          <line
            key={`line-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={LINE_COLOR}
            strokeWidth={lineStrokeWidth}
            opacity={getLineOpacity(line.avgZ)}
          />
        ))}
        
        {/* Nodes with simple depth fade */}
        {nodes.map((node, i) => {
          const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
          return (
            <circle
              key={`node-${i}`}
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={NODE_COLOR}
              opacity={getNodeOpacity(node.z)}
            />
          );
        })}
        
        {/* Subtle orbital rings */}
        <ellipse
          cx="150" cy="150" rx="120" ry="40"
          fill="none" stroke={LINE_COLOR}
          strokeWidth={ringStrokeWidth} opacity={0.4}
        />
        <ellipse
          cx="150" cy="150" rx="100" ry="100"
          fill="none" stroke={LINE_COLOR}
          strokeWidth={ringStrokeWidth} opacity={0.4}
        />
        </svg>
        
        <style>{`
          @keyframes networkSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default NetworkGlobe;

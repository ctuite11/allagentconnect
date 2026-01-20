import React from 'react';

/**
 * Neutral architectural network globe for homepage hero
 * Reads as subtle infrastructure / watermark background
 * NOT a tech feature - must recede behind content
 */

// Neutral gray colors - warmer/darker to align with logo gray family
const LINE_COLOR = '#A1A1AA'; // zinc-400
const NODE_COLOR = '#71717A'; // zinc-500

interface NetworkGlobeProps {
  variant?: 'hero' | 'ambient' | 'static';
  strokeColor?: string;
  fillTriangles?: boolean;
}

const NetworkGlobe = ({ variant = 'hero', strokeColor, fillTriangles = false }: NetworkGlobeProps) => {
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

  // Generate triangles from connected node triplets
  const triangles = React.useMemo(() => {
    if (!fillTriangles) return [];
    
    const tris: { points: string; avgZ: number }[] = [];
    const maxDist = 100;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distIJ = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) + 
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        if (distIJ > maxDist) continue;
        
        for (let k = j + 1; k < nodes.length; k++) {
          const distIK = Math.sqrt(
            Math.pow(nodes[i].x - nodes[k].x, 2) + 
            Math.pow(nodes[i].y - nodes[k].y, 2)
          );
          const distJK = Math.sqrt(
            Math.pow(nodes[j].x - nodes[k].x, 2) + 
            Math.pow(nodes[j].y - nodes[k].y, 2)
          );
          
          if (distIK < maxDist && distJK < maxDist) {
            const avgZ = (nodes[i].z + nodes[j].z + nodes[k].z) / 3;
            tris.push({
              points: `${nodes[i].x},${nodes[i].y} ${nodes[j].x},${nodes[j].y} ${nodes[k].x},${nodes[k].y}`,
              avgZ
            });
          }
        }
      }
    }
    return tris;
  }, [nodes, fillTriangles]);
  
  // Lines: back ~0.40, front ~0.72
  const getLineOpacity = (z: number) => {
    const t = (z + 1) / 2;
    return 0.40 + t * 0.32;
  };

  // Triangles: back ~0.10, front ~0.30
  const getTriangleOpacity = (z: number) => {
    const t = (z + 1) / 2;
    return 0.10 + t * 0.20;
  };

  // Nodes: back ~0.52, front ~0.86
  const getNodeOpacity = (z: number) => {
    const t = (z + 1) / 2;
    return 0.52 + t * 0.34;
  };

  // Stroke weights - slightly bumped for visibility
  const lineStrokeWidth = 1.15;
  const ringStrokeWidth = 0.85;
  const nodeRadius = { large: 2.5, small: 2.0 };

  // Static mode: no animation
  if (isStatic || prefersReducedMotion) {
    return (
      <div 
        className="w-full h-full pointer-events-none flex items-center justify-center"
        aria-hidden="true"
        style={{ opacity: fillTriangles ? 1 : 0.08 }}
      >
        <svg viewBox="0 0 300 300" className="w-full h-full" style={strokeColor ? { color: strokeColor } : undefined}>
          {/* Filled triangles when enabled */}
          {fillTriangles && triangles.map((tri, i) => (
            <polygon
              key={`tri-${i}`}
              points={tri.points}
              fill="currentColor"
              opacity={getTriangleOpacity(tri.avgZ)}
            />
          ))}
          
          {/* Connection lines */}
          {connections.map((line, i) => (
            <line
              key={`line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="currentColor"
              strokeWidth={fillTriangles ? 1.5 : lineStrokeWidth}
              opacity={fillTriangles ? getLineOpacity(line.avgZ) * 1.2 : getLineOpacity(line.avgZ)}
            />
          ))}
          
          {/* Subtle orbital rings - hide when filling triangles */}
          {!fillTriangles && (
            <>
              <ellipse
                cx="150" cy="150" rx="120" ry="40"
                fill="none"
                stroke="currentColor"
                strokeWidth={ringStrokeWidth}
                opacity={0.4}
              />
              <ellipse
                cx="150" cy="150" rx="100" ry="100"
                fill="none"
                stroke="currentColor"
                strokeWidth={ringStrokeWidth}
                opacity={0.4}
              />
            </>
          )}
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
      className="relative w-[680px] h-[680px] md:w-[720px] md:h-[720px] lg:w-[820px] lg:h-[820px]"
      aria-hidden="true"
    >
      {/* Globe container - neutral architectural watermark */}
      <div
        className="absolute inset-0 opacity-[0.18] [filter:saturate(1.08)_contrast(1.08)]"
        style={{
          maskImage: 'radial-gradient(circle at 50% 50%, black 0%, black 55%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, black 55%, transparent 78%)',
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
        {/* Connection lines only - no nodes for cleaner architectural look */}
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

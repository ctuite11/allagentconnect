import React from 'react';

/**
 * Network globe with true 3D rotation
 * Nodes and connections rotate around Y-axis for genuine depth effect
 */

// Neutral gray colors - warmer/darker to align with logo gray family
const LINE_COLOR = '#8A8A8F'; // between zinc-400/500, warmer
const NODE_COLOR = '#A8A8AD'; // darker than zinc-300, warmer

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
  
  // Rotation angle for 3D effect (in radians)
  const [rotationAngle, setRotationAngle] = React.useState(0);

  // Animate rotation - 1 full rotation every 120 seconds
  React.useEffect(() => {
    if (prefersReducedMotion || isStatic) return;
    
    let animationId: number;
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000; // seconds
      lastTime = currentTime;
      
      // 120 seconds per full rotation = 2π / 120 radians per second
      setRotationAngle(prev => (prev + delta * (Math.PI * 2) / 120) % (Math.PI * 2));
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [prefersReducedMotion, isStatic]);
  
  // Use provided strokeColor or default neutral colors
  const lineColor = strokeColor || LINE_COLOR;
  const nodeColor = strokeColor || NODE_COLOR;
  
  // Tilt angle for Earth-like perspective (-18 degrees)
  const tiltAngle = -18 * (Math.PI / 180);
  const cosTilt = Math.cos(tiltAngle);
  const sinTilt = Math.sin(tiltAngle);
  
  // Generate network nodes with Y-axis rotation applied
  const nodes = React.useMemo(() => {
    const points: { x: number; y: number; z: number }[] = [];
    const count = 24;
    const radius = 120;
    const centerX = 150;
    const centerY = 150;
    
    // Use rotation angle for animated mode, 0 for static
    const angle = (isStatic || prefersReducedMotion) ? 0 : rotationAngle;
    const cosR = Math.cos(angle);
    const sinR = Math.sin(angle);
    
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      
      // Original 3D position on unit sphere
      const x3d = Math.cos(theta) * Math.sin(phi);
      const y3d = Math.sin(theta) * Math.sin(phi);
      const z3d = Math.cos(phi);
      
      // Apply Y-axis rotation
      const rotatedX = x3d * cosR - z3d * sinR;
      const rotatedZ = x3d * sinR + z3d * cosR;
      
      // Apply tilt (rotateX)
      const tiltedY = y3d * cosTilt - rotatedZ * sinTilt;
      const tiltedZ = y3d * sinTilt + rotatedZ * cosTilt;
      
      points.push({
        x: centerX + radius * rotatedX,
        y: centerY + radius * tiltedY,
        z: tiltedZ // Use for depth-based opacity
      });
    }
    return points;
  }, [rotationAngle, isStatic, prefersReducedMotion, cosTilt, sinTilt]);

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
  
  // Simple depth fade for lines: back ~0.35, front ~0.65
  const getLineOpacity = (z: number) => {
    const t = (z + 1) / 2; // normalize to 0..1
    return 0.35 + t * 0.30;
  };
  
  // Depth fade for triangles: back ~0.08, front ~0.25
  const getTriangleOpacity = (z: number) => {
    const t = (z + 1) / 2;
    return 0.08 + t * 0.17;
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

  // Animated mode (hero or ambient) - true 3D rotation via node position updates
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
};

export default NetworkGlobe;

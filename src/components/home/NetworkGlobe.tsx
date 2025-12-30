import React from 'react';

/**
 * Subtle network sphere animation for homepage hero
 * Cloudflare-inspired, infrastructure feel
 * Desktop only, purely decorative
 */
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
            opacity: (1 - dist / 100) * 0.4
          });
        }
      }
    }
    return lines;
  }, [nodes]);

  return (
    <div 
      className="absolute inset-0 hidden md:block overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Fade mask - softens globe toward text on left */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          background: 'linear-gradient(90deg, white 0%, white 30%, transparent 60%)'
        }}
      />
      
      {/* Network sphere */}
      <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-[400px] h-[400px]">
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{
            animation: 'networkSpin 35s linear infinite',
            opacity: 0.07
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
              stroke="#16a34a"
              strokeWidth="0.5"
              opacity={line.opacity}
            />
          ))}
          
          {/* Nodes */}
          {nodes.map((node, i) => (
            <circle
              key={`node-${i}`}
              cx={node.x}
              cy={node.y}
              r={node.z > 0 ? 2 : 1.5}
              fill="#16a34a"
              opacity={0.3 + node.z * 0.3}
            />
          ))}
          
          {/* Subtle orbital rings */}
          <ellipse
            cx="150"
            cy="150"
            rx="120"
            ry="40"
            fill="none"
            stroke="#16a34a"
            strokeWidth="0.3"
            opacity="0.3"
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke="#16a34a"
            strokeWidth="0.3"
            opacity="0.2"
          />
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

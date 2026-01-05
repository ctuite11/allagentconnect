import React, { useEffect, useState } from 'react';

/**
 * Subtle network sphere animation for homepage hero
 * Calm, ambient, infrastructure feel
 * Supports two variants:
 * - "hero" (default): Home page positioning, full effects
 * - "ambient": Centered, smaller, no pulse, slower rotation, desaturated
 */

// Toggle this to true for placement/sizing assessment
const DEBUG_VISIBLE = false;

// Brand colors
const LINE_COLOR = '#4169E1'; // Royal Blue
const DOT_COLOR = '#94A3B8';  // slate-400 (matches "Connect" in logo)

interface NetworkGlobeProps {
  variant?: 'hero' | 'ambient' | 'static';
  strokeColor?: string;
}

const NetworkGlobe = ({ variant = 'hero', strokeColor }: NetworkGlobeProps) => {
  const isAmbient = variant === 'ambient';
  const isStatic = variant === 'static';
  
  // Use provided strokeColor or default brand colors
  const lineColor = strokeColor || LINE_COLOR;
  const dotColor = strokeColor || DOT_COLOR;
  
  // Track which nodes are currently pulsing (for white blink) - hero mode only
  const [pulsingNodes, setPulsingNodes] = useState<Set<number>>(new Set());
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
            opacity: DEBUG_VISIBLE ? 0.5 : 0.25 + (1 - dist / 100) * 0.75
          });
        }
      }
    }
    return lines;
  }, [nodes]);

  // White twinkle pulse effect - visible and alive (hero mode only)
  useEffect(() => {
    // Skip pulse animation in ambient/static mode
    if (isAmbient || isStatic) return;
    
    const triggerPulse = () => {
      // Pick 1 random node to pulse
      const nodeIndex = Math.floor(Math.random() * nodes.length);
      
      // Duration: 120-180ms per pulse
      const duration = 120 + Math.random() * 60;
      
      setPulsingNodes(prev => {
        const next = new Set(prev);
        next.add(nodeIndex);
        return next;
      });
      
      // Remove pulse after duration
      setTimeout(() => {
        setPulsingNodes(prev => {
          const next = new Set(prev);
          next.delete(nodeIndex);
          return next;
        });
      }, duration);
    };

    // Slower cadence: trigger every 800-1200ms
    const intervalId = setInterval(() => {
      triggerPulse();
    }, 800 + Math.random() * 400); // ~1000ms average

    // Initial trigger
    triggerPulse();

    return () => clearInterval(intervalId);
  }, [nodes.length, isAmbient, isStatic]);

  // Debug vs production styles
  const svgOpacity = DEBUG_VISIBLE ? 0.55 : 1;
  const lineStrokeWidth = DEBUG_VISIBLE ? 1.5 : 2;
  const ringStrokeWidth = DEBUG_VISIBLE ? 1 : 1.5;
  const nodeRadius = DEBUG_VISIBLE ? { large: 4, small: 3 } : { large: 4, small: 3.5 };

  // Ambient mode: slower rotation, desaturated
  const rotationSpeed = isAmbient ? '14s' : '90s';
  const ambientFilter = isAmbient ? 'saturate(0.6)' : 'none';
  const ambientOpacity = isAmbient ? 0.65 : svgOpacity;

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
                fill={strokeColor ? 'currentColor' : dotColor}
                opacity={0.6}
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
            opacity={0.7}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={strokeColor ? 'currentColor' : lineColor}
            strokeWidth={ringStrokeWidth}
            opacity={0.6}
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
        style={{ filter: ambientFilter }}
      >
        <svg 
          viewBox="0 0 300 300" 
          className="w-full h-full"
          style={{
            animation: `networkSpin ${rotationSpeed} linear infinite`,
            opacity: ambientOpacity
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
                fill={DOT_COLOR}
                opacity={0.3}
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
            opacity={0.8}
          />
          <ellipse
            cx="150"
            cy="150"
            rx="100"
            ry="100"
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={ringStrokeWidth}
            opacity={0.7}
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

  // Hero mode - original positioning and behavior
  return (
    <div 
      className="absolute inset-0 hidden md:block overflow-visible pointer-events-none"
      aria-hidden="true"
      style={DEBUG_VISIBLE ? { zIndex: 20 } : { zIndex: 2 }}
    >
      
      {/* Network sphere */}
      <div 
        className="pt-3 absolute right-0 lg:right-4 top-[48%] -translate-y-1/2 w-[500px] h-[500px] lg:w-[620px] lg:h-[620px] max-w-[80vh] max-h-[80vh]"
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
            animation: 'networkSpin 90s linear infinite',
            opacity: svgOpacity
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
          
          {/* Nodes with white twinkle pulse effect */}
          {nodes.map((node, i) => {
            const isPulsing = pulsingNodes.has(i);
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            
            return (
              <circle
                key={`node-${i}`}
                cx={node.x}
                cy={node.y}
                r={isPulsing ? radius * 1.2 : radius}
                fill={isPulsing ? '#FFFFFF' : DOT_COLOR}
                opacity={isPulsing ? 0.85 : 0.3}
                style={{
                  transition: 'r 80ms ease-out, fill 80ms ease-out, opacity 80ms ease-out'
                }}
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

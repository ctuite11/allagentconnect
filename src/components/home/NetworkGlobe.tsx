import React, { useEffect, useState } from 'react';

/**
 * Subtle network sphere animation for homepage hero
 * Calm, ambient, infrastructure feel
 * Desktop only, purely decorative
 */

// Toggle this to true for placement/sizing assessment
const DEBUG_VISIBLE = false;

// Brand colors
const LINE_COLOR = '#059669'; // emerald-600
const DOT_COLOR = '#94A3B8';  // slate-400 (matches "Connect" in logo)
const PULSE_GREEN = '#059669'; // emerald-600 for green pulses

const NetworkGlobe = () => {
  // Track which nodes are currently pulsing (for white blink)
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

  // White twinkle pulse effect - visible and alive
  useEffect(() => {
    const triggerPulse = () => {
      // Pick 2-4 random nodes to pulse each tick
      const nodesToPulse = 2 + Math.floor(Math.random() * 3); // 2, 3, or 4 nodes
      const indices: number[] = [];
      
      for (let i = 0; i < nodesToPulse; i++) {
        let nodeIndex = Math.floor(Math.random() * nodes.length);
        // Avoid duplicates
        while (indices.includes(nodeIndex)) {
          nodeIndex = Math.floor(Math.random() * nodes.length);
        }
        indices.push(nodeIndex);
      }
      
      // Duration: 120-180ms per pulse
      const duration = 120 + Math.random() * 60;
      
      setPulsingNodes(prev => {
        const next = new Set(prev);
        indices.forEach(idx => next.add(idx));
        return next;
      });
      
      // Remove pulse after duration
      setTimeout(() => {
        setPulsingNodes(prev => {
          const next = new Set(prev);
          indices.forEach(idx => next.delete(idx));
          return next;
        });
      }, duration);
    };

    // Slower cadence: trigger every 400-700ms
    const intervalId = setInterval(() => {
      triggerPulse();
    }, 400 + Math.random() * 300); // ~550ms average

    // Initial trigger
    triggerPulse();

    return () => clearInterval(intervalId);
  }, [nodes.length]);

  // Debug vs production styles
  const svgOpacity = DEBUG_VISIBLE ? 0.55 : 1;
  const lineStrokeWidth = DEBUG_VISIBLE ? 1.5 : 2;
  const ringStrokeWidth = DEBUG_VISIBLE ? 1 : 1.5;
  const nodeRadius = DEBUG_VISIBLE ? { large: 4, small: 3 } : { large: 4, small: 3.5 };

  return (
    <div 
      className="absolute inset-0 hidden md:block overflow-visible pointer-events-none"
      aria-hidden="true"
      style={DEBUG_VISIBLE ? { zIndex: 20 } : { zIndex: 2 }}
    >
      
      {/* Network sphere */}
      <div 
        className="absolute right-4 lg:right-10 top-[48%] -translate-y-1/2 w-[420px] h-[420px] lg:w-[520px] lg:h-[520px] max-w-[70vh] max-h-[70vh]"
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

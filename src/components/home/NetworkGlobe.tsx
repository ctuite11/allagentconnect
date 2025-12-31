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
  // Track which nodes are currently pulsing
  const [pulsingNodes, setPulsingNodes] = useState<Map<number, 'green' | 'white'>>(new Map());

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

  // Random node pulse effect
  useEffect(() => {
    const triggerPulse = () => {
      const nodeIndex = Math.floor(Math.random() * nodes.length);
      
      // 90% chance green, 10% chance white
      const pulseType: 'green' | 'white' = Math.random() < 0.9 ? 'green' : 'white';
      const duration = pulseType === 'green' 
        ? 200 + Math.random() * 100  // 200-300ms for green
        : 120 + Math.random() * 60;   // 120-180ms for white
      
      setPulsingNodes(prev => {
        const next = new Map(prev);
        next.set(nodeIndex, pulseType);
        return next;
      });
      
      // Remove pulse after duration
      setTimeout(() => {
        setPulsingNodes(prev => {
          const next = new Map(prev);
          next.delete(nodeIndex);
          return next;
        });
      }, duration);
    };

    // Trigger pulses at random intervals (2-5 seconds apart)
    const scheduleNextPulse = () => {
      const delay = 2000 + Math.random() * 3000;
      return setTimeout(() => {
        triggerPulse();
        timerId = scheduleNextPulse();
      }, delay);
    };

    let timerId = scheduleNextPulse();

    return () => clearTimeout(timerId);
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
            animation: 'networkSpin 46s linear infinite',
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
          
          {/* Nodes with pulse effect */}
          {nodes.map((node, i) => {
            const pulseType = pulsingNodes.get(i);
            const isPulsing = pulseType !== undefined;
            const fillColor = isPulsing 
              ? (pulseType === 'green' ? PULSE_GREEN : '#FFFFFF')
              : DOT_COLOR;
            const radius = node.z > 0 ? nodeRadius.large : nodeRadius.small;
            
            return (
              <circle
                key={`node-${i}`}
                cx={node.x}
                cy={node.y}
                r={isPulsing ? radius * 1.3 : radius}
                fill={fillColor}
                opacity={1}
                style={{
                  transition: 'r 150ms ease-out, fill 100ms ease-out'
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

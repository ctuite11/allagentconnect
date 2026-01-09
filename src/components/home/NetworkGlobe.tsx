import React from 'react';
import { Delaunay } from 'd3-delaunay';

/**
 * True 3D rotating network globe for homepage hero
 * Nodes orbit the sphere with depth-based opacity
 * Internal requestAnimationFrame rotation (no CSS spin)
 * Diamond variant: faceted crystal disc with network overlay
 */

// Neutral gray colors - warmer/darker to align with logo gray family
const LINE_COLOR = '#8A8A8F';
const NODE_COLOR = '#A8A8AD';

interface NetworkGlobeProps {
  variant?: 'hero' | 'ambient' | 'static' | 'mark' | 'diamond';
  strokeColor?: string;
  fillTriangles?: boolean;
}

type Node3D = { x: number; y: number; z: number; seed: number };
type Node2D = { x: number; y: number; z: number; seed: number };

// Stable hash RNG for deterministic facet families
const rand01 = (s: number) => {
  const x = Math.sin(s * 999.123) * 43758.5453;
  return x - Math.floor(x);
};

const NetworkGlobe = ({ variant = 'hero', strokeColor, fillTriangles = false }: NetworkGlobeProps) => {
  const isStatic = variant === 'static';
  const isMark = variant === 'mark';
  const isDiamond = variant === 'diamond';
  
  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  
  // Rotation angle state for 3D animation
  const [rotationAngle, setRotationAngle] = React.useState(0);
  
  // Shimmer time state for diamond variant (separate from rotation for proper 75s cycle)
  const [shimmerT, setShimmerT] = React.useState(0);

  // Animation loop - for hero and diamond variants
  React.useEffect(() => {
    if (isStatic || isMark || prefersReducedMotion) return;
    
    let raf = 0;
    let last = performance.now();
    
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      
      // One full rotation every 75 seconds (crystal: slow but perceptible)
      setRotationAngle((prev) => (prev + (dt * Math.PI * 2) / 75) % (Math.PI * 2));
      
      // Shimmer time accumulator for diamond (75s cycle)
      if (isDiamond) {
        setShimmerT((prev) => prev + dt);
      }
      
      raf = requestAnimationFrame(tick);
    };
    
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isStatic, isMark, isDiamond, prefersReducedMotion]);
  
  // Use provided strokeColor or default neutral colors
  const lineColor = strokeColor || LINE_COLOR;
  const nodeColor = strokeColor || NODE_COLOR;
  
  // 1) Fixed 3D sphere points (computed once)
  const baseNodes = React.useMemo<Node3D[]>(() => {
    const points: Node3D[] = [];
    const count = 24;

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;

      points.push({
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi),
        seed: i * 97,
      });
    }

    return points;
  }, []);

  // 2) Projected nodes (recomputed each frame for animation)
  const nodes = React.useMemo<Node2D[]>(() => {
    const cx = 150;
    const cy = 150;
    const r = 120;
    const tilt = -0.30; // ~17° for Earth-like tilt

    const cosR = Math.cos(rotationAngle);
    const sinR = Math.sin(rotationAngle);
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    return baseNodes.map((p) => {
      // Rotate around Y
      const rx = p.x * cosR - p.z * sinR;
      const rz = p.x * sinR + p.z * cosR;

      // Tilt around X
      const ty = p.y * cosT - rz * sinT;
      const tz = p.y * sinT + rz * cosT;

      return {
        x: cx + r * rx,
        y: cy + r * ty,
        z: tz,
        seed: p.seed,
      };
    });
  }, [baseNodes, rotationAngle]);

  // Nodes sorted for depth rendering
  const drawNodes = React.useMemo(
    () => nodes.slice().sort((a, b) => a.z - b.z),
    [nodes]
  );

  // Precompute index-pairs for edges (once, using 3D chord distance)
  const edgePairs = React.useMemo(() => {
    const pairs: Array<[number, number]> = [];
    const maxDist = 100;
    const chordThresh = maxDist / 120;

    for (let i = 0; i < baseNodes.length; i++) {
      for (let j = i + 1; j < baseNodes.length; j++) {
        const dx = baseNodes[i].x - baseNodes[j].x;
        const dy = baseNodes[i].y - baseNodes[j].y;
        const dz = baseNodes[i].z - baseNodes[j].z;
        const chord = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (chord < chordThresh) pairs.push([i, j]);
      }
    }
    return pairs;
  }, [baseNodes]);

  // Build the renderable connections each frame from those pairs
  const connections = React.useMemo(() => {
    return edgePairs.map(([i, j]) => {
      const a = nodes[i];
      const b = nodes[j];
      return {
        x1: a.x, y1: a.y,
        x2: b.x, y2: b.y,
        avgZ: (a.z + b.z) / 2,
      };
    });
  }, [edgePairs, nodes]);

  // Precompute triangle triplets once
  const triTriplets = React.useMemo(() => {
    if (!fillTriangles) return [] as Array<[number, number, number]>;

    const tris: Array<[number, number, number]> = [];
    const maxDist = 100;
    const chordThresh = maxDist / 120;

    for (let i = 0; i < baseNodes.length; i++) {
      for (let j = i + 1; j < baseNodes.length; j++) {
        const dxij = baseNodes[i].x - baseNodes[j].x;
        const dyij = baseNodes[i].y - baseNodes[j].y;
        const dzij = baseNodes[i].z - baseNodes[j].z;
        const dij = Math.sqrt(dxij * dxij + dyij * dyij + dzij * dzij);
        if (dij > chordThresh) continue;

        for (let k = j + 1; k < baseNodes.length; k++) {
          const dxik = baseNodes[i].x - baseNodes[k].x;
          const dyik = baseNodes[i].y - baseNodes[k].y;
          const dzik = baseNodes[i].z - baseNodes[k].z;
          const dik = Math.sqrt(dxik * dxik + dyik * dyik + dzik * dzik);
          if (dik > chordThresh) continue;

          const dxjk = baseNodes[j].x - baseNodes[k].x;
          const dyjk = baseNodes[j].y - baseNodes[k].y;
          const dzjk = baseNodes[j].z - baseNodes[k].z;
          const djk = Math.sqrt(dxjk * dxjk + dyjk * dyjk + dzjk * dzjk);
          if (djk > chordThresh) continue;

          tris.push([i, j, k]);
        }
      }
    }

    return tris;
  }, [baseNodes, fillTriangles]);

  // Build renderable triangles each frame
  const triangles = React.useMemo(() => {
    if (!fillTriangles) return [] as { points: string; avgZ: number; seed: number }[];

    return triTriplets.map(([i, j, k], idx) => {
      const a = nodes[i];
      const b = nodes[j];
      const c = nodes[k];
      const avgZ = (a.z + b.z + c.z) / 3;

      return {
        points: `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`,
        avgZ,
        seed: (a.seed + b.seed + c.seed + idx) * 0.01,
      };
    });
  }, [triTriplets, nodes, fillTriangles]);

  // Depth helpers
  const depth01 = (z: number) => (z + 1) / 2;

  // Crystal refraction triangle fill (glass planes)
  const triFill = (seed: number, avgZ: number) => {
    const d = depth01(avgZ);
    const wave = Math.sin(rotationAngle * 0.65 + seed); // slower wave

    // Crystal HSL variation for refraction shimmer
    const hue = 224 + wave * 2.2;
    const sat = 86 + wave * 3.5;
    const lit = 54 + wave * 4.0 + d * 6.0;

    return {
      fill: `hsl(${hue} ${sat}% ${lit}%)`,
      alpha: 0.06 + d * 0.16, // back ~0.06, front ~0.22 (glass planes)
    };
  };
  
  // Crystal line opacity (structure, not the star)
  const getLineOpacity = (z: number) => {
    const t = depth01(z);
    return 0.08 + t * 0.18; // back ~0.08, front ~0.26
  };
  
  // Line width varies with depth (subtle)
  const getLineWidth = (z: number) => {
    const t = depth01(z);
    return 0.7 + t * 0.5; // back ~0.7, front ~1.2
  };

  // Node opacity (specular highlights = "alive" cue)
  const getNodeOpacity = (z: number) => {
    const t = depth01(z);
    return 0.18 + t * 0.82; // back ~0.18, front ~1.0
  };

  // Node radius for depth effect
  const getNodeRadius = (z: number) => {
    const t = depth01(z);
    return 0.9 + t * 2.6; // back ~0.9, front ~3.5
  };

  // Thinner stroke weights for subtlety
  const ringStrokeWidth = 0.75;

  // Crystal glow filter (soft, slightly blue, not uniform)
  const glowDefs = (
    <defs>
      <filter id="aacGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Diamond clip mask */}
      <clipPath id="diamondClip">
        <circle cx="150" cy="150" r="118" />
      </clipPath>
    </defs>
  );

  // ==================== DIAMOND VARIANT ====================
  // Diamond disc points - generate once (Poisson-like distribution)
  const diamondPoints = React.useMemo(() => {
    if (!isDiamond) return [];
    
    const points: Array<{ x: number; y: number; seed: number }> = [];
    const cx = 150;
    const cy = 150;
    const radius = 118;
    const count = 200;
    
    // Golden angle spiral for even distribution
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 * 8.17;
      const r = radius * Math.sqrt(i / count) * 0.95;
      points.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        seed: i * 73,
      });
    }
    
    return points;
  }, [isDiamond]);

  // Diamond facets via Delaunay triangulation (computed once)
  const diamondFacets = React.useMemo(() => {
    if (!isDiamond || diamondPoints.length === 0) return [];
    
    // Correct Delaunay usage with accessor functions
    const delaunay = Delaunay.from(diamondPoints, p => p.x, p => p.y);
    const triangleIndices = delaunay.triangles;
    
    const facets: Array<{
      indices: [number, number, number];
      seed: number;
      distFromCenter: number;
    }> = [];
    
    const cx = 150;
    const cy = 150;
    const radius = 118;
    
    for (let i = 0; i < triangleIndices.length; i += 3) {
      const i0 = triangleIndices[i];
      const i1 = triangleIndices[i + 1];
      const i2 = triangleIndices[i + 2];
      
      const p0 = diamondPoints[i0];
      const p1 = diamondPoints[i1];
      const p2 = diamondPoints[i2];
      
      const centroidX = (p0.x + p1.x + p2.x) / 3;
      const centroidY = (p0.y + p1.y + p2.y) / 3;
      const distFromCenter = Math.sqrt((centroidX - cx) ** 2 + (centroidY - cy) ** 2) / radius;
      
      facets.push({
        indices: [i0, i1, i2],
        seed: (p0.seed + p1.seed + p2.seed) * 0.01,
        distFromCenter,
      });
    }
    
    return facets;
  }, [isDiamond, diamondPoints]);

  // Diamond facet color logic - brilliant cut with AAC blue
  const getDiamondFacetStyle = (seed: number, distFromCenter: number) => {
    // 75s shimmer cycle using shimmerT (decoupled from rotation)
    const wave = Math.sin((shimmerT * 2 * Math.PI) / 75 + seed);
    const fastWave = Math.sin((shimmerT * 2 * Math.PI) / 25 + seed * 2.3);
    
    // Stable hash for deterministic family assignment
    const r = rand01(seed);
    const r2 = rand01(seed + 50); // second hash for variation
    
    // Brilliant cut: center is blue, outer ring transitions to light/white
    // Create zones: core (0-0.35), mid (0.35-0.65), outer (0.65-1.0)
    const isCore = distFromCenter < 0.35;
    const isMid = distFromCenter >= 0.35 && distFromCenter < 0.65;
    const isOuter = distFromCenter >= 0.65;
    
    let hue: number, sat: number, lit: number;
    let family: 'blue' | 'light' | 'dark' | 'highlight';
    
    if (isCore) {
      // Core: mostly vivid AAC blue with some deep blue variation
      if (r < 0.70) {
        // Vivid AAC blue (like reference diamond center)
        hue = 218 + wave * 6; // AAC blue hue
        sat = 85 + wave * 8 + r2 * 10;
        lit = 52 + wave * 8 + r2 * 12;
        family = 'blue';
      } else {
        // Deep blue shadows in core
        hue = 220 + wave * 4;
        sat = 75 + wave * 6;
        lit = 32 + wave * 5;
        family = 'dark';
      }
    } else if (isMid) {
      // Mid ring: mix of blue, light reflections, and dark facets
      if (r < 0.40) {
        // Blue facets (less saturated than core)
        hue = 218 + wave * 5;
        sat = 70 + wave * 8 + r2 * 8;
        lit = 58 + wave * 10 + r2 * 10;
        family = 'blue';
      } else if (r < 0.65) {
        // Bright white/silver highlights (like light catching facets)
        hue = 210 + wave * 3;
        sat = 12 + wave * 6;
        lit = 92 + wave * 4 + fastWave * 3;
        family = 'highlight';
      } else {
        // Dark facets for contrast
        hue = 220 + wave * 3;
        sat = 25 + wave * 5;
        lit = 28 + wave * 6 + r2 * 8;
        family = 'dark';
      }
    } else {
      // Outer ring: mostly light/white with some blue accents
      if (r < 0.55) {
        // Bright white/silver (brilliant edge reflections)
        hue = 208 + wave * 4;
        sat = 15 + wave * 5;
        lit = 94 + wave * 3 + fastWave * 2;
        family = 'highlight';
      } else if (r < 0.75) {
        // Light blue tint
        hue = 216 + wave * 4;
        sat = 45 + wave * 8;
        lit = 78 + wave * 6;
        family = 'light';
      } else {
        // Dark facets (give edge definition)
        hue = 218 + wave * 3;
        sat = 20 + wave * 5;
        lit = 35 + wave * 5 + r2 * 10;
        family = 'dark';
      }
    }
    
    // Alpha based on family and position
    let alpha: number;
    if (family === 'blue') {
      alpha = 0.55 + (1 - distFromCenter) * 0.35 + wave * 0.05;
    } else if (family === 'highlight') {
      alpha = 0.40 + (1 - distFromCenter) * 0.25 + fastWave * 0.08;
    } else if (family === 'light') {
      alpha = 0.35 + (1 - distFromCenter) * 0.20;
    } else {
      // dark
      alpha = 0.50 + (1 - distFromCenter) * 0.30 + wave * 0.05;
    }
    
    return {
      fill: `hsl(${hue} ${sat}% ${lit}%)`,
      alpha: Math.max(0.25, Math.min(0.92, alpha)),
    };
  };
  
  // Diamond-specific opacity helpers (reduced to let diamond be the star)
  const getLineOpacityDiamond = (z: number) => 0.05 + depth01(z) * 0.10; // max 0.15
  const getLineWidthDiamond = (z: number) => 0.6 + depth01(z) * 0.4; // max 1.0
  const getNodeOpacityDiamond = (z: number) => 0.12 + depth01(z) * 0.35; // max 0.47
  const getNodeRadiusDiamond = (z: number) => 0.8 + depth01(z) * 1.6; // max 2.4

  // Diamond variant render
  if (isDiamond) {
    return (
      <div 
        className="w-full h-full pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {glowDefs}
          
          {/* Rim gradient definition */}
          <defs>
            <radialGradient id="rimRad" cx="50%" cy="45%" r="60%">
              <stop offset="60%" stopColor="rgba(255,255,255,0)" />
              <stop offset="78%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="92%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          
          <g filter="url(#aacGlow)">
            {/* Diamond disc facets + rim inside clipPath */}
            <g clipPath="url(#diamondClip)">
              {diamondFacets.map((facet, i) => {
                const p0 = diamondPoints[facet.indices[0]];
                const p1 = diamondPoints[facet.indices[1]];
                const p2 = diamondPoints[facet.indices[2]];
                const { fill, alpha } = getDiamondFacetStyle(facet.seed, facet.distFromCenter);
                return (
                  <polygon
                    key={`facet-${i}`}
                    points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                    fill={fill}
                    fillOpacity={alpha}
                    stroke="rgba(180,185,195,0.18)"
                    strokeWidth={0.5}
                  />
                );
              })}
              
              {/* Rim lighting inside clip (radial glow + edge stroke) */}
              <circle cx="150" cy="150" r="118" fill="url(#rimRad)" opacity="0.9" />
            </g>
            
            {/* Rim edge stroke (outside clip for crisp edge) */}
            <circle
              cx="150"
              cy="150"
              r="118"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.4"
            />
            
            {/* Network layer overlay (reduced opacity for diamond) */}
            {/* Connection lines */}
            {[...connections].sort((a, b) => a.avgZ - b.avgZ).map((line, i) => (
              <line
                key={`line-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={strokeColor || lineColor}
                strokeOpacity={getLineOpacityDiamond(line.avgZ)}
                strokeWidth={getLineWidthDiamond(line.avgZ)}
              />
            ))}
            
            {/* Nodes as specular highlights (reduced for diamond) */}
            {drawNodes.map((n, i) => {
              const t = depth01(n.z);
              const r = getNodeRadiusDiamond(n.z);
              return (
                <g key={`node-${i}`}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={nodeColor}
                    opacity={getNodeOpacityDiamond(n.z)}
                  />
                  {t > 0.6 && (
                    <circle
                      cx={n.x - r * 0.3}
                      cy={n.y - r * 0.3}
                      r={r * 0.28}
                      fill="white"
                      opacity={(t - 0.6) * 0.5}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    );
  }

  // Mark variant: 130x130px, blue-filled triangles, no nodes
  if (isMark) {
    return (
      <div 
        className="w-[130px] h-[130px] pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {glowDefs}
          <g filter="url(#aacGlow)">
            {/* Filled triangles */}
            {[...triangles].sort((a, b) => a.avgZ - b.avgZ).map((tri, i) => (
              <polygon
                key={`tri-${i}`}
                points={tri.points}
                fill="#0E56F5"
                fillOpacity={0.14 + depth01(tri.avgZ) * 0.26}
              />
            ))}
            
            {/* Connection lines */}
            {[...connections].sort((a, b) => a.avgZ - b.avgZ).map((line, i) => (
              <line
                key={`line-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#0E56F5"
                strokeOpacity={getLineOpacity(line.avgZ)}
                strokeWidth={getLineWidth(line.avgZ)}
              />
            ))}

            {/* Nodes */}
            {drawNodes.map((n, i) => (
              <circle
                key={`node-${i}`}
                cx={n.x}
                cy={n.y}
                r={getNodeRadius(n.z)}
                fill="#0E56F5"
                opacity={getNodeOpacity(n.z)}
              />
            ))}
          </g>
        </svg>
      </div>
    );
  }

  // Static mode: no animation
  if (isStatic || prefersReducedMotion) {
    return (
      <div 
        className="w-full h-full pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 300 300" className="w-full h-full" style={strokeColor ? { color: strokeColor } : undefined}>
          {glowDefs}
          <g filter="url(#aacGlow)">
            {/* Filled triangles when enabled - sorted back to front */}
            {fillTriangles && [...triangles].sort((a, b) => a.avgZ - b.avgZ).map((tri, i) => {
              const { fill, alpha } = triFill(tri.seed, tri.avgZ);
              return (
                <polygon
                  key={`tri-${i}`}
                  points={tri.points}
                  fill={fill}
                  fillOpacity={alpha}
                />
              );
            })}
            
            {/* Connection lines - sorted back to front */}
            {[...connections].sort((a, b) => a.avgZ - b.avgZ).map((line, i) => (
              <line
                key={`line-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={strokeColor || lineColor}
                strokeWidth={getLineWidth(line.avgZ)}
                strokeOpacity={getLineOpacity(line.avgZ)}
              />
            ))}

            {/* Nodes with specular glints - sorted back to front */}
            {drawNodes.map((n, i) => {
              const t = depth01(n.z);
              const r = getNodeRadius(n.z);
              return (
                <g key={`node-${i}`}>
                  {/* Base node */}
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={nodeColor}
                    opacity={getNodeOpacity(n.z)}
                  />
                  {/* Specular glint (front-biased) */}
                  {t > 0.55 && (
                    <circle
                      cx={n.x - r * 0.25}
                      cy={n.y - r * 0.25}
                      r={r * 0.35}
                      fill="white"
                      opacity={(t - 0.55) * 0.55}
                    />
                  )}
                </g>
              );
            })}
            
            {/* Subtle orbital rings - hide when filling triangles */}
            {!fillTriangles && (
              <>
                <ellipse
                  cx="150" cy="150" rx="120" ry="40"
                  fill="none"
                  stroke={strokeColor || lineColor}
                  strokeWidth={ringStrokeWidth}
                  opacity={0.4}
                />
                <ellipse
                  cx="150" cy="150" rx="100" ry="100"
                  fill="none"
                  stroke={strokeColor || lineColor}
                  strokeWidth={ringStrokeWidth}
                  opacity={0.4}
                />
              </>
            )}
          </g>
        </svg>
      </div>
    );
  }

  // Hero mode - true 3D rotation with nodes orbiting the sphere
  return (
    <div 
      className="w-full h-full pointer-events-none flex items-center justify-center"
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 300" className="w-full h-full" style={strokeColor ? { color: strokeColor } : undefined}>
        {glowDefs}
        <g filter="url(#aacGlow)">
          {/* Filled triangles - sorted back to front, with shimmer */}
          {fillTriangles && [...triangles].sort((a, b) => a.avgZ - b.avgZ).map((tri, i) => {
            const { fill, alpha } = triFill(tri.seed, tri.avgZ);
            return (
              <polygon
                key={`tri-${i}`}
                points={tri.points}
                fill={fill}
                fillOpacity={alpha}
              />
            );
          })}
          
          {/* Connection lines - sorted back to front, depth-based opacity */}
          {[...connections].sort((a, b) => a.avgZ - b.avgZ).map((line, i) => (
            <line
              key={`line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={strokeColor || lineColor}
              strokeOpacity={getLineOpacity(line.avgZ)}
              strokeWidth={getLineWidth(line.avgZ)}
            />
          ))}

          {/* Nodes with specular glints - back to front for depth */}
          {drawNodes.map((n, i) => {
            const t = depth01(n.z);
            const r = getNodeRadius(n.z);
            return (
              <g key={`node-${i}`}>
                {/* Base node */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={nodeColor}
                  opacity={getNodeOpacity(n.z)}
                />
                {/* Specular glint (front-biased, glass refraction effect) */}
                {t > 0.55 && (
                  <circle
                    cx={n.x - r * 0.25}
                    cy={n.y - r * 0.25}
                    r={r * 0.35}
                    fill="white"
                    opacity={(t - 0.55) * 0.55}
                  />
                )}
              </g>
            );
          })}
          
          {/* Subtle orbital rings - hide when filling triangles */}
          {!fillTriangles && (
            <>
              <ellipse
                cx="150" cy="150" rx="120" ry="40"
                fill="none"
                stroke={strokeColor || lineColor}
                strokeWidth={ringStrokeWidth}
                opacity={0.4}
              />
              <ellipse
                cx="150" cy="150" rx="100" ry="100"
                fill="none"
                stroke={strokeColor || lineColor}
                strokeWidth={ringStrokeWidth}
                opacity={0.4}
              />
            </>
          )}
        </g>
      </svg>
    </div>
  );
};

export default NetworkGlobe;

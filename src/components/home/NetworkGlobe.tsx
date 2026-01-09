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

  // Diamond facet color logic with stable hash RNG
  const getDiamondFacetStyle = (seed: number, distFromCenter: number) => {
    // 75s shimmer cycle using shimmerT (decoupled from rotation)
    const wave = Math.sin((shimmerT * 2 * Math.PI) / 75 + seed);
    
    // Stable hash for deterministic family assignment
    const r = rand01(seed);
    const blueEligible = distFromCenter < 0.55;
    
    let hue: number, sat: number, lit: number;
    let isBlue = false;
    
    if (r < 0.60) {
      // Light facets: sharper whites (60%)
      hue = 220 + wave * 5;
      sat = 8 + wave * 4;
      lit = 94 + wave * 3 - distFromCenter * 6;
    } else if (r < 0.85 || !blueEligible) {
      // Dark facets: deeper charcoal (25% or non-center)
      hue = 220 + wave * 3;
      sat = 6 + wave * 3;
      lit = 36 + wave * 5 + distFromCenter * 6;
    } else {
      // Blue accent facets: AAC blue (15%, center only)
      hue = 224 + wave * 4;
      sat = 85 + wave * 5;
      lit = 54 + wave * 5 - distFromCenter * 12;
      isBlue = true;
    }
    
    // Blue facets get softer alpha to feel "internal"
    let alpha: number;
    if (isBlue) {
      alpha = 0.18 + (1 - distFromCenter) * 0.28; // softer, internal glow
    } else {
      alpha = 0.35 + (1 - distFromCenter) * 0.45 + wave * 0.08;
    }
    
    // Allow lower alpha for blue (0.10) vs others (0.15)
    const minA = isBlue ? 0.10 : 0.15;
    return {
      fill: `hsl(${hue} ${sat}% ${lit}%)`,
      alpha: Math.max(minA, Math.min(0.85, alpha)),
    };
  };

  // Diamond variant render
  if (isDiamond) {
    return (
      <div 
        className="w-full h-full pointer-events-none flex items-center justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 300 300" className="w-full h-full">
          {glowDefs}
          
          <g filter="url(#aacGlow)">
            {/* Diamond disc facets (base layer) with clipPath */}
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
                    stroke="rgba(180,185,195,0.25)"
                    strokeWidth={0.6}
                  />
                );
              })}
            </g>
            
            {/* Rim lighting (subtle diamond cut edge) */}
            <defs>
              <linearGradient id="rimGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                <stop offset="40%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.10)" />
              </linearGradient>
            </defs>
            <circle
              cx="150"
              cy="150"
              r="118"
              fill="none"
              stroke="url(#rimGrad)"
              strokeWidth="1.4"
            />
            
            {/* Network layer overlay */}
            {/* Connection lines */}
            {[...connections].sort((a, b) => a.avgZ - b.avgZ).map((line, i) => (
              <line
                key={`line-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={strokeColor || lineColor}
                strokeOpacity={getLineOpacity(line.avgZ) * 0.6}
                strokeWidth={getLineWidth(line.avgZ) * 0.8}
              />
            ))}
            
            {/* Nodes as specular highlights */}
            {drawNodes.map((n, i) => {
              const t = depth01(n.z);
              const r = getNodeRadius(n.z);
              return (
                <g key={`node-${i}`}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill={nodeColor}
                    opacity={getNodeOpacity(n.z)}
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

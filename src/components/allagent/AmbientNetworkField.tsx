import { cn } from "@/lib/utils";

/**
 * AmbientNetworkField - Cloudflare-inspired subtle network animation
 * Purely decorative element for hero zone only
 * Features: slow drift + stroke-dashoffset "signals moving through lines"
 */
const AmbientNetworkField = ({ className }: { className?: string }) => {
  return (
    <div 
      className={cn(
        "pointer-events-none select-none w-[400px] h-[300px]",
        className
      )}
      aria-hidden="true"
    >
      {/* Fade mask for premium edge blending */}
      <div 
        className="absolute inset-0"
        style={{
          maskImage: 'radial-gradient(ellipse 80% 70% at 70% 40%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 70% 40%, black 30%, transparent 70%)',
        }}
      >
        <svg 
          viewBox="0 0 400 300" 
          className="w-full h-full"
          style={{ opacity: 0.06 }}
        >
          {/* Static network paths */}
          <g 
            stroke="currentColor" 
            strokeWidth="0.5" 
            fill="none" 
            className="text-emerald-600"
          >
            {/* Primary network paths */}
            <path d="M20,180 Q100,120 180,140 T320,110 T400,130" className="animate-[networkDrift_25s_ease-in-out_infinite]" />
            <path d="M0,220 Q80,180 160,200 T300,170 T380,190" className="animate-[networkDrift_30s_ease-in-out_infinite_reverse]" />
            <path d="M40,100 Q120,140 200,110 T360,130 T400,100" className="animate-[networkDrift_22s_ease-in-out_infinite]" />
            
            {/* Signal paths with stroke-dashoffset animation */}
            <path 
              d="M60,160 Q140,100 240,130 T380,100" 
              strokeDasharray="6 14"
              className="animate-[signalFlow_20s_linear_infinite]"
              style={{ opacity: 0.8 }}
            />
            <path 
              d="M0,140 Q100,180 200,150 T360,180" 
              strokeDasharray="4 18"
              className="animate-[signalFlow_28s_linear_infinite_reverse]"
              style={{ opacity: 0.6 }}
            />
          </g>
          
          {/* Subtle node points at intersections */}
          <g fill="currentColor" className="text-emerald-600" style={{ opacity: 0.4 }}>
            <circle cx="180" cy="140" r="2" className="animate-[networkDrift_25s_ease-in-out_infinite]" />
            <circle cx="300" cy="120" r="1.5" className="animate-[networkDrift_30s_ease-in-out_infinite_reverse]" />
            <circle cx="240" cy="170" r="2" className="animate-[networkDrift_22s_ease-in-out_infinite]" />
            <circle cx="120" cy="150" r="1.5" className="animate-[networkDrift_28s_ease-in-out_infinite]" />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default AmbientNetworkField;

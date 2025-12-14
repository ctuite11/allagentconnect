import { useState, useEffect, useCallback } from "react";

interface WelcomeInterstitialProps {
  onComplete: () => void;
}

export const WelcomeInterstitial = ({ onComplete }: WelcomeInterstitialProps) => {
  const [phase, setPhase] = useState<"fade-in" | "visible" | "fade-out">("fade-in");

  const handleDismiss = useCallback(() => {
    if (phase === "fade-out") return;
    setPhase("fade-out");
    setTimeout(() => {
      onComplete();
    }, 500);
  }, [phase, onComplete]);

  useEffect(() => {
    // Fade in duration
    const fadeInTimer = setTimeout(() => {
      setPhase("visible");
    }, 500);

    // Escape key handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(fadeInTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDismiss]);

  const opacity = phase === "fade-in" ? "opacity-0" : phase === "visible" ? "opacity-100" : "opacity-0";

  return (
    <div 
      onClick={handleDismiss}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 cursor-pointer ${opacity}`}
    >
      <h1 className="text-6xl md:text-8xl font-light tracking-tight text-foreground mb-6">
        Shhh.
      </h1>
      <p className="text-lg md:text-xl tracking-widest text-muted-foreground uppercase">
        Connect • Communicate • Collaborate
      </p>
      <p className="mt-8 text-sm text-muted-foreground/60">
        Click anywhere or press Escape to continue
      </p>
    </div>
  );
};

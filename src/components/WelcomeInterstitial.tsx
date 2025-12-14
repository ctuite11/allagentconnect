import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface WelcomeInterstitialProps {
  onComplete: () => void;
}

export const WelcomeInterstitial = ({ onComplete }: WelcomeInterstitialProps) => {
  const [phase, setPhase] = useState<"fade-in" | "visible" | "fade-out">("fade-in");

  useEffect(() => {
    // Fade in duration
    const fadeInTimer = setTimeout(() => {
      setPhase("visible");
    }, 300);

    // Start fade out
    const fadeOutTimer = setTimeout(() => {
      setPhase("fade-out");
    }, 700);

    // Complete and transition
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1000);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const opacity = phase === "fade-in" ? "opacity-0" : phase === "visible" ? "opacity-100" : "opacity-0";

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-300 ${opacity}`}
    >
      <h1 className="text-6xl md:text-8xl font-light tracking-tight text-foreground mb-6">
        Shhh.
      </h1>
      <p className="text-lg md:text-xl tracking-widest text-muted-foreground uppercase">
        Connect • Communicate • Collaborate
      </p>
    </div>
  );
};

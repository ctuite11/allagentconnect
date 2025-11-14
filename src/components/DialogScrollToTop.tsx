import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

interface DialogScrollToTopProps {
  scrollContainerRef?: React.RefObject<HTMLElement>;
  threshold?: number;
}

const DialogScrollToTop = ({ 
  scrollContainerRef, 
  threshold = 200 
}: DialogScrollToTopProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const defaultRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollContainerRef || defaultRef;

  useEffect(() => {
    const scrollContainer = containerRef.current;
    if (!scrollContainer) return;

    const toggleVisibility = () => {
      if (scrollContainer.scrollTop > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    scrollContainer.addEventListener("scroll", toggleVisibility);

    return () => {
      scrollContainer.removeEventListener("scroll", toggleVisibility);
    };
  }, [containerRef, threshold]);

  const scrollToTop = () => {
    const scrollContainer = containerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <>
      {isVisible && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-20 right-8 z-50 h-10 w-10 rounded-full shadow-lg animate-fade-in hover-scale"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </>
  );
};

export default DialogScrollToTop;

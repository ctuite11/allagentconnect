import { useEffect } from "react";
import { cn } from "@/lib/utils";

const SORO_EMBED_CONTAINER_ID = "soro-blog";
const SORO_EMBED_SCRIPT_ID = "soro-blog-embed-script";
const SORO_EMBED_SCRIPT_SRC =
  "https://app.trysoro.com/api/embed/3ec34c09-dcec-42ad-963e-4b7654896d6b";

let activeMountCount = 0;

type SoroBlogEmbedProps = {
  className?: string;
};

/**
 * Mounts the Soro blog embed container and loads the external script once per document.
 */
export function SoroBlogEmbed({ className }: SoroBlogEmbedProps) {
  useEffect(() => {
    activeMountCount += 1;

    let script = document.getElementById(SORO_EMBED_SCRIPT_ID) as HTMLScriptElement | null;
    const createdScript = !script;

    if (!script) {
      script = document.createElement("script");
      script.id = SORO_EMBED_SCRIPT_ID;
      script.src = SORO_EMBED_SCRIPT_SRC;
      script.defer = true;
      document.body.appendChild(script);
    }

    return () => {
      activeMountCount -= 1;

      if (createdScript && activeMountCount === 0) {
        script?.parentNode?.removeChild(script);
      }
    };
  }, []);

  return <div id={SORO_EMBED_CONTAINER_ID} className={cn("min-h-[480px] w-full", className)} />;
}

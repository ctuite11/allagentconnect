import React from "react";
import { AacMonogramLoader } from "@/components/AacMonogramLoader";

/** Full-viewport loading used by routes and detail pages. */
export const LoadingScreen: React.FC<{ message?: string }> = ({ message }) => {
  return <AacMonogramLoader variant="fullscreen" message={message ?? "Loading..."} />;
};

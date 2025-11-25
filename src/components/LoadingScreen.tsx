import React from "react";

export const LoadingScreen: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-4 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">
          {message ?? "Loading..."}
        </p>
      </div>
    </div>
  );
};

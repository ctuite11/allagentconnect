import React from "react";

export const LoadingScreen: React.FC<{ message?: string; neutralSpinner?: boolean }> = ({
  message,
  neutralSpinner,
}) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div
          className={
            neutralSpinner
              ? "h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-700"
              : "h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"
          }
        />
        <p className="text-muted-foreground text-sm">
          {message ?? "Loading..."}
        </p>
      </div>
    </div>
  );
};

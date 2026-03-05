import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export default function UnsubscribeHotSheet() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [hotSheetName, setHotSheetName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("success"); // idempotent — treat missing token as already done
      return;
    }

    (async () => {
      try {
        const data = await invokeEdgeFunction("unsubscribe-hotsheet", { token }) as any;
        if (data?.success) {
          setHotSheetName(data.hotSheetName as string || null);
        }
        setStatus("success");
      } catch {
        // Still show success for idempotency — don't leak existence
        setStatus("success");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" ? (
            <p className="text-muted-foreground">Processing…</p>
          ) : status === "success" ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h1 className="text-xl font-semibold">You've been unsubscribed</h1>
              <p className="text-muted-foreground">
                {hotSheetName
                  ? `You will no longer receive email updates for "${hotSheetName}".`
                  : "You will no longer receive email updates for this Hot Sheet."}
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-muted-foreground">Please try again later.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

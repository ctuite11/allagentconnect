import { ShieldX, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";

const AccessError = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
    <Logo className="h-8 mb-10 opacity-80" />

    <div className="text-center max-w-sm">
      <ShieldX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h1 className="text-xl font-semibold text-foreground mb-2">Access Unavailable</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Your account doesn't have a role assigned yet, or access has been restricted.
        Reach out and we'll get you sorted.
      </p>

      <Button asChild>
        <a href="mailto:hello@allagentconnect.com">
          <Mail className="w-4 h-4 mr-2" />
          Contact Support
        </a>
      </Button>
    </div>
  </div>
);

export default AccessError;

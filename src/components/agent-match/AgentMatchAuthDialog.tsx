import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgentMatchAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (email: string) => void;
  isLoading: boolean;
}

const AgentMatchAuthDialog = ({ open, onOpenChange, onComplete, isLoading }: AgentMatchAuthDialogProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [authLoading, setAuthLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setAuthLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/agent-match`,
            data: {
              full_name: name,
              role: "seller",
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please log in instead.");
            setMode("login");
          } else {
            throw error;
          }
          return;
        }

        toast.success("Account created!");
        onComplete(email);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        toast.success("Logged in!");
        onComplete(email);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const loading = authLoading || isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "signup" ? "Create your free account" : "Welcome back"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signup"
              ? "Create an account to see how many AAC Verified agents match your property."
              : "Log in to see your matches."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full bg-[#0E56F5] hover:bg-[#0D4AD9]" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "signup" ? "Creating Account..." : "Logging In..."}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {mode === "signup" ? "Create Account & See Matches" : "Log In & See Matches"}
              </>
            )}
          </Button>

          <p className="text-center text-sm text-zinc-500">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-[#0E56F5] hover:underline font-medium"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-[#0E56F5] hover:underline font-medium"
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgentMatchAuthDialog;

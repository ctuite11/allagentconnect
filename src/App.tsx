import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AgentDashboard from "./pages/AgentDashboard";
import SubmitBuyerNeed from "./pages/SubmitBuyerNeed";
import AddListing from "./pages/AddListing";
import AddRentalListing from "./pages/AddRentalListing";
import EditListing from "./pages/EditListing";
import PropertyDetail from "./pages/PropertyDetail";
import ConsumerPropertyDetail from "./pages/ConsumerPropertyDetail";
import BrowseProperties from "./pages/BrowseProperties";
import OurAgents from "./pages/OurAgents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/browse" element={<BrowseProperties />} />
          <Route path="/our-agents" element={<OurAgents />} />
          <Route path="/agent-dashboard" element={<AgentDashboard />} />
          <Route path="/submit-buyer-need" element={<SubmitBuyerNeed />} />
          <Route path="/add-listing" element={<AddListing />} />
          <Route path="/add-rental-listing" element={<AddRentalListing />} />
          <Route path="/edit-listing/:id" element={<EditListing />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/consumer-property/:id" element={<ConsumerPropertyDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AgentDashboard from "./pages/AgentDashboard";
import BuyerAuth from "./pages/BuyerAuth";
// import removed: AgentSearch (redirect to OurAgents)
import SubmitClientNeed from "./pages/SubmitClientNeed";
import ClientNeedsDashboard from "./pages/ClientNeedsDashboard";
import AddListing from "./pages/AddListing";
import AddRentalListing from "./pages/AddRentalListing";
import EditListing from "./pages/EditListing";
import PropertyDetail from "./pages/PropertyDetail";
import ConsumerPropertyDetail from "./pages/ConsumerPropertyDetail";
import AgentProfile from "./pages/AgentProfile";
import AgentProfileEditor from "./pages/AgentProfileEditor";
import ManageTeam from "./pages/ManageTeam";
import TeamProfile from "./pages/TeamProfile";
import ManageCoverageAreas from "./pages/ManageCoverageAreas";
import BrowseProperties from "./pages/BrowseProperties";
import SearchResults from "./pages/SearchResults";
import OurAgents from "./pages/OurAgents";
import Favorites from "./pages/Favorites";
import HotSheets from "./pages/HotSheets";
import HotSheetReview from "./pages/HotSheetReview";
import MyClients from "./pages/MyClients";
import ClientHotSheet from "./pages/ClientHotSheet";
import ListingAnalytics from "./pages/ListingAnalytics";
import MarketInsights from "./pages/MarketInsights";
import VendorDashboard from "./pages/VendorDashboard";
import VendorSetup from "./pages/VendorSetup";
import VendorPackages from "./pages/VendorPackages";
import VendorDirectory from "./pages/VendorDirectory";
import ConsumerHome from "./pages/ConsumerHome";
import ConsumerDashboard from "./pages/ConsumerDashboard";
import ConsumerAuth from "./pages/ConsumerAuth";
import PasswordReset from "./pages/PasswordReset";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <Sonner />
            <Routes>
          {/* Coming Soon landing page - only public route */}
          <Route path="/" element={<ComingSoon />} />
          {/* Redirect all other routes to coming soon */}
          <Route path="*" element={<ComingSoon />} />
        </Routes>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;

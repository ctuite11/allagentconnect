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
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <Sonner />
            <Routes>
          {/* Public routes - authentication pages */}
          <Route path="/consumer/auth" element={<ConsumerAuth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/buyer-auth" element={<BuyerAuth />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          
          {/* Protected routes - require authentication */}
          <Route path="/" element={<ProtectedRoute><ConsumerHome /></ProtectedRoute>} />
          <Route path="/agent-home" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/browse" element={<ProtectedRoute><BrowseProperties /></ProtectedRoute>} />
          <Route path="/search-results" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
          <Route path="/our-agents" element={<ProtectedRoute><OurAgents /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/hot-sheets" element={<ProtectedRoute><HotSheets /></ProtectedRoute>} />
          <Route path="/hot-sheets/:id/review" element={<ProtectedRoute><HotSheetReview /></ProtectedRoute>} />
          <Route path="/my-clients" element={<ProtectedRoute><MyClients /></ProtectedRoute>} />
          <Route path="/client-hot-sheet/:token" element={<ProtectedRoute><ClientHotSheet /></ProtectedRoute>} />
          <Route path="/agent-search" element={<ProtectedRoute><OurAgents /></ProtectedRoute>} />
          <Route path="/agent-dashboard" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
          <Route path="/submit-buyer-need" element={<Navigate to="/submit-client-need" replace />} />
          <Route path="/submit-client-need" element={<ProtectedRoute><SubmitClientNeed /></ProtectedRoute>} />
          <Route path="/client-needs" element={<ProtectedRoute><ClientNeedsDashboard /></ProtectedRoute>} />
          <Route path="/add-listing" element={<ProtectedRoute><AddListing /></ProtectedRoute>} />
          <Route path="/add-rental-listing" element={<ProtectedRoute><AddRentalListing /></ProtectedRoute>} />
          <Route path="/edit-listing/:id" element={<ProtectedRoute><EditListing /></ProtectedRoute>} />
          <Route path="/property/:id" element={<ProtectedRoute><PropertyDetail /></ProtectedRoute>} />
          <Route path="/consumer-property/:id" element={<ProtectedRoute><ConsumerPropertyDetail /></ProtectedRoute>} />
          <Route path="/agent/:id" element={<ProtectedRoute><AgentProfile /></ProtectedRoute>} />
          <Route path="/agent-profile-editor" element={<ProtectedRoute><AgentProfileEditor /></ProtectedRoute>} />
          <Route path="/manage-team" element={<ProtectedRoute><ManageTeam /></ProtectedRoute>} />
          <Route path="/team/:id" element={<ProtectedRoute><TeamProfile /></ProtectedRoute>} />
          <Route path="/manage-coverage-areas" element={<ProtectedRoute><ManageCoverageAreas /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><ListingAnalytics /></ProtectedRoute>} />
          <Route path="/analytics/:id" element={<ProtectedRoute><ListingAnalytics /></ProtectedRoute>} />
          <Route path="/market-insights" element={<ProtectedRoute><MarketInsights /></ProtectedRoute>} />
          <Route path="/vendor/dashboard" element={<ProtectedRoute><VendorDashboard /></ProtectedRoute>} />
          <Route path="/vendor/setup" element={<ProtectedRoute><VendorSetup /></ProtectedRoute>} />
          <Route path="/vendor/packages" element={<ProtectedRoute><VendorPackages /></ProtectedRoute>} />
          <Route path="/vendor/directory" element={<ProtectedRoute><VendorDirectory /></ProtectedRoute>} />
          <Route path="/consumer/dashboard" element={<ProtectedRoute><ConsumerDashboard /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;

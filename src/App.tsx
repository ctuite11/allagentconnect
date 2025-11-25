import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import { AgentProtectedRoute } from "./components/AgentProtectedRoute";
import { ClientProtectedRoute } from "./components/ClientProtectedRoute";
import AgentSuccessHub from "./pages/AgentSuccessHub";
import BuyerAuth from "./pages/BuyerAuth";
// import removed: AgentSearch (redirect to OurAgents)
import SubmitClientNeed from "./pages/SubmitClientNeed";
import ClientNeedsDashboard from "./pages/ClientNeedsDashboard";
import ListingIntel from "./pages/ListingIntel";
import AddListing from "./pages/AddListing";
import AddRentalListing from "./pages/AddRentalListing";
// EditListing removed - now handled by AddListing with :id param
import PropertyDetail from "./pages/PropertyDetail";
import ConsumerPropertyDetail from "./pages/ConsumerPropertyDetail";
import AgentProfile from "./pages/AgentProfile";
import AgentProfileEditor from "./pages/AgentProfileEditor";
import ManageTeam from "./pages/ManageTeam";
import TeamProfile from "./pages/TeamProfile";
import ManageCoverageAreas from "./pages/ManageCoverageAreas";
import BrowsePropertiesNew from "./pages/BrowsePropertiesNew";
import SearchResults from "./pages/SearchResults";
import OurAgents from "./pages/OurAgents";
import Favorites from "./pages/Favorites";
import MyFavorites from "./pages/MyFavorites";
import HotSheets from "./pages/HotSheets";
import HotSheetReview from "./pages/HotSheetReview";
import MyClients from "./pages/MyClients";
import ClientHotSheet from "./pages/ClientHotSheet";
import ClientHotsheetPage from "./pages/ClientHotsheetPage";
import ClientInvitationSetup from "./pages/ClientInvitationSetup";
import ListingAnalytics from "./pages/ListingAnalytics";
import MarketInsights from "./pages/MarketInsights";
import VendorDashboard from "./pages/VendorDashboard";
import VendorSetup from "./pages/VendorSetup";
import VendorPackages from "./pages/VendorPackages";
import VendorDirectory from "./pages/VendorDirectory";
import ConsumerHome from "./pages/ConsumerHome";
import ConsumerDashboard from "./pages/ConsumerDashboard";
import ConsumerAuth from "./pages/ConsumerAuth";
import ClientAgentSettings from "./pages/ClientAgentSettings";
import ClientDashboard from "./pages/ClientDashboard";
import ClientCreateHotsheetNew from "./pages/ClientCreateHotsheetNew";
import ClientFavoritesPage from "./pages/ClientFavoritesPage";
import PasswordReset from "./pages/PasswordReset";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import SeedTestData from "./pages/SeedTestData";
import ShareLinkHandler from "./pages/ShareLinkHandler";
import ScrollToTop from "./components/ScrollToTop";
import ScrollRestoration from "./components/ScrollRestoration";
import { ActiveAgentBanner } from "./components/ActiveAgentBanner";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true }}>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <Sonner />
            <ScrollToTop />
            <ScrollRestoration />
            <ActiveAgentBanner />
            <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/agent-dashboard" element={<AgentProtectedRoute><AgentSuccessHub /></AgentProtectedRoute>} />
          <Route path="/buyer/auth" element={<BuyerAuth />} />
          <Route path="/submit-client-need" element={<SubmitClientNeed />} />
          <Route path="/client-needs" element={<AgentProtectedRoute><ClientNeedsDashboard /></AgentProtectedRoute>} />
          <Route path="/listing-intel" element={<AgentProtectedRoute><ListingIntel /></AgentProtectedRoute>} />
          <Route path="/add-listing" element={<AgentProtectedRoute><AddListing /></AgentProtectedRoute>} />
          <Route path="/add-listing/:id" element={<AgentProtectedRoute><AddListing /></AgentProtectedRoute>} />
          <Route path="/add-rental-listing" element={<AgentProtectedRoute><AddRentalListing /></AgentProtectedRoute>} />
          <Route path="/edit-listing/:id" element={<Navigate to="/add-listing/:id" replace />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/consumer-property/:id" element={<ConsumerPropertyDetail />} />
          <Route path="/agent/:id" element={<AgentProfile />} />
          <Route path="/agent-profile-editor" element={<AgentProtectedRoute><AgentProfileEditor /></AgentProtectedRoute>} />
          <Route path="/manage-team" element={<AgentProtectedRoute><ManageTeam /></AgentProtectedRoute>} />
          <Route path="/team/:id" element={<TeamProfile />} />
          <Route path="/manage-coverage-areas" element={<AgentProtectedRoute><ManageCoverageAreas /></AgentProtectedRoute>} />
          <Route path="/browse" element={<BrowsePropertiesNew />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/our-agents" element={<OurAgents />} />
          <Route path="/agent-search" element={<OurAgents />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/my-favorites" element={<MyFavorites />} />
          <Route path="/hot-sheets" element={<AgentProtectedRoute><HotSheets /></AgentProtectedRoute>} />
          <Route path="/hot-sheets/:id/review" element={<AgentProtectedRoute><HotSheetReview /></AgentProtectedRoute>} />
          <Route path="/my-clients" element={<AgentProtectedRoute><MyClients /></AgentProtectedRoute>} />
          <Route path="/client-invite" element={<ClientInvitationSetup />} />
          <Route path="/client-hot-sheet/:token" element={<ClientHotSheet />} />
          <Route path="/client/hotsheet/:token" element={<ClientHotsheetPage />} />
          <Route path="/analytics" element={<AgentProtectedRoute><ListingAnalytics /></AgentProtectedRoute>} />
          <Route path="/analytics/:id" element={<AgentProtectedRoute><ListingAnalytics /></AgentProtectedRoute>} />
          <Route path="/market-insights" element={<MarketInsights />} />
          <Route path="/vendor/dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/setup" element={<VendorSetup />} />
          <Route path="/vendor/packages" element={<VendorPackages />} />
          <Route path="/vendor/directory" element={<VendorDirectory />} />
          <Route path="/consumer/home" element={<ConsumerHome />} />
          <Route path="/consumer/dashboard" element={<ConsumerDashboard />} />
          <Route path="/consumer/auth" element={<ConsumerAuth />} />
          <Route path="/client-agent-settings" element={<ClientProtectedRoute><ClientAgentSettings /></ClientProtectedRoute>} />
          <Route path="/client/dashboard" element={<ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute>} />
          <Route path="/client/hotsheets/new" element={<ClientProtectedRoute><ClientCreateHotsheetNew /></ClientProtectedRoute>} />
          <Route path="/client/favorites" element={<ClientProtectedRoute><ClientFavoritesPage /></ClientProtectedRoute>} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/seed-test-data" element={<SeedTestData />} />
          <Route path="/link/:token" element={<ShareLinkHandler />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;

import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import AuthDiagnostics from "./pages/AuthDiagnostics";
import { RouteGuard } from "./components/RouteGuard";
// AgentSuccessHub archived → AgentSuccessHub.legacy.tsx
import AgentSuccessHub from "./pages/AgentSuccessHub.legacy";

import MLSPINSearch from "./pages/MLSPINSearch";
import ListingSearch from "./pages/ListingSearch";
import ListingSearchResults from "./pages/ListingSearchResults";

import SubmitClientNeed from "./pages/SubmitClientNeed";
import ClientNeedsDashboard from "./pages/ClientNeedsDashboard";
import CommunicationCenter from "./pages/CommunicationCenter";
import ListingIntel from "./pages/ListingIntel";
import AddListing from "./pages/AddListing";
import AddRentalListing from "./pages/AddRentalListing";
import PropertyDetail from "./pages/PropertyDetail";
import AgentDetailRedirect from "./pages/AgentDetailRedirect";
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
import PasswordReset from "./pages/PasswordReset";
import PendingVerification from "./pages/PendingVerification";
import NotFound from "./pages/NotFound";
import MyListings from "./pages/MyListings";
import ManageListingPhotos from "./pages/ManageListingPhotos";
import AdminApprovals from "./pages/AdminApprovals";


import ComingSoon from "./pages/ComingSoon";
import SeedTestData from "./pages/SeedTestData";
import AllAgentConnectHome from "./pages/AllAgentConnectHome";
import ShareLinkHandler from "./pages/ShareLinkHandler";
import ScrollToTop from "./components/ScrollToTop";
import ScrollRestoration from "./components/ScrollRestoration";
import { ActiveAgentBanner } from "./components/ActiveAgentBanner";
import Navigation from "./components/Navigation";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true }}>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <Sonner />
            <ScrollToTop />
            <ScrollRestoration />
            <>
              <ActiveAgentBanner />
              <Navigation />
              <Routes>
                <Route path="/" element={<Index />} />
                
                {/* Auth routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/diagnostics" element={<AuthDiagnostics />} />
                <Route path="/pending-verification" element={<PendingVerification />} />
                <Route path="/password-reset" element={<PasswordReset />} />
                
                {/* Legacy redirects - all go to /auth */}
                <Route path="/choose" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/get-started" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/onboarding" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/onboarding/create-account" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/onboarding/verify-license" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/verify-agent" element={<Navigate to="/auth?mode=register" replace />} />
                
                {/* Legacy route redirect */}
                <Route path="/allagentconnect" element={<Navigate to="/agent-dashboard" replace />} />
                
                {/* Agent routes - ALL require verification by default via RouteGuard */}
                <Route path="/agent-dashboard" element={<RouteGuard requireRole="agent"><AgentSuccessHub /></RouteGuard>} />
                <Route path="/agent/listings" element={<RouteGuard requireRole="agent"><MyListings /></RouteGuard>} />
                <Route path="/agent/listings/new" element={<RouteGuard requireRole="agent"><AddListing /></RouteGuard>} />
                <Route path="/agent/listings/:id/photos" element={<RouteGuard requireRole="agent"><ManageListingPhotos /></RouteGuard>} />
                <Route path="/agent/listings/:id/floor-plans" element={<RouteGuard requireRole="agent"><ManageListingPhotos mode="floorPlans" /></RouteGuard>} />
                <Route path="/agent/listings/edit/:id" element={<RouteGuard requireRole="agent"><AddListing /></RouteGuard>} />
                <Route path="/agent/listings/:id" element={<RouteGuard requireRole="agent"><AgentDetailRedirect /></RouteGuard>} />
                <Route path="/buyer/auth" element={<Navigate to="/auth" replace />} />
                <Route path="/submit-client-need" element={<SubmitClientNeed />} />
                <Route path="/client-needs" element={<RouteGuard requireRole="agent"><ClientNeedsDashboard /></RouteGuard>} />
                <Route path="/communication-center" element={<RouteGuard requireRole="agent"><CommunicationCenter /></RouteGuard>} />
                <Route path="/listing-intel" element={<RouteGuard requireRole="agent"><ListingIntel /></RouteGuard>} />
                <Route path="/add-rental-listing" element={<RouteGuard requireRole="agent"><AddRentalListing /></RouteGuard>} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/consumer-property/:id" element={<ConsumerPropertyDetail />} />
                <Route path="/agent/:id" element={<AgentProfile />} />
                <Route path="/agent/profile" element={<RouteGuard requireRole="agent"><AgentProfileEditor /></RouteGuard>} />
                <Route path="/agent-profile-editor" element={<RouteGuard requireRole="agent"><AgentProfileEditor /></RouteGuard>} />
                <Route path="/manage-team" element={<RouteGuard requireRole="agent"><ManageTeam /></RouteGuard>} />
                <Route path="/team/:id" element={<TeamProfile />} />
                <Route path="/manage-coverage-areas" element={<RouteGuard requireRole="agent"><ManageCoverageAreas /></RouteGuard>} />
                <Route path="/browse" element={<BrowsePropertiesNew />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/our-agents" element={<OurAgents />} />
                <Route path="/agents" element={<OurAgents />} />
                <Route path="/find-agent" element={<OurAgents />} />
                <Route path="/our-members" element={<RouteGuard requireRole="agent"><OurAgents defaultAgentMode={true} /></RouteGuard>} />
                <Route path="/members" element={<RouteGuard requireRole="agent"><OurAgents defaultAgentMode={true} /></RouteGuard>} />
                <Route path="/agent-search" element={<MLSPINSearch />} />
                <Route path="/listing-search" element={<ListingSearch />} />
                <Route path="/listing-results" element={<ListingSearchResults />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/my-favorites" element={<MyFavorites />} />
                <Route path="/hot-sheets" element={<RouteGuard requireRole="agent"><HotSheets /></RouteGuard>} />
                <Route path="/agent/off-market" element={<Navigate to="/agent/listings?status=off_market" replace />} />
                <Route path="/hot-sheets/:id/review" element={<RouteGuard requireRole="agent"><HotSheetReview /></RouteGuard>} />
                <Route path="/my-clients" element={<RouteGuard requireRole="agent"><MyClients /></RouteGuard>} />
                <Route path="/client-invite" element={<ClientInvitationSetup />} />
                <Route path="/client-hot-sheet/:token" element={<ClientHotSheet />} />
                <Route path="/client/hotsheet/:token" element={<ClientHotsheetPage />} />
                <Route path="/analytics" element={<RouteGuard requireRole="agent"><ListingAnalytics /></RouteGuard>} />
                <Route path="/analytics/:id" element={<RouteGuard requireRole="agent"><ListingAnalytics /></RouteGuard>} />
                <Route path="/market-insights" element={<MarketInsights />} />
                <Route path="/vendor/dashboard" element={<VendorDashboard />} />
                <Route path="/vendor/setup" element={<VendorSetup />} />
                <Route path="/vendor/packages" element={<VendorPackages />} />
                <Route path="/vendor/directory" element={<VendorDirectory />} />
                {/* Legacy consumer routes - redirect to auth */}
                <Route path="/consumer/home" element={<Navigate to="/auth" replace />} />
                <Route path="/consumer/dashboard" element={<Navigate to="/auth" replace />} />
                <Route path="/consumer/auth" element={<Navigate to="/auth" replace />} />
                <Route path="/client-agent-settings" element={<Navigate to="/auth" replace />} />
                <Route path="/client/dashboard" element={<Navigate to="/auth" replace />} />
                <Route path="/client/hotsheets/new" element={<Navigate to="/auth" replace />} />
                <Route path="/client/favorites" element={<Navigate to="/auth" replace />} />
                <Route path="/seed-test-data" element={<SeedTestData />} />
                <Route path="/link/:token" element={<ShareLinkHandler />} />
                <Route path="/admin/approvals" element={<AdminApprovals />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;

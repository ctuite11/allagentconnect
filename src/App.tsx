

import React, { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, Outlet, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import { AppShell } from "@/components/layout/AppShell";
import { BuyerShell } from "@/components/layout/BuyerShell";
import { CrossTabSessionGuard } from "@/components/CrossTabSessionGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import AuthDiagnostics from "./pages/AuthDiagnostics";
import AuthSetupRedirect from "./pages/AuthSetupRedirect";
import { RouteGuard } from "./components/RouteGuard";
// AgentSuccessHub archived → AgentSuccessHub.legacy.tsx
import AgentSuccessHub from "./pages/AgentSuccessHub.legacy";
import ShowingRequests from "./pages/ShowingRequests";

import MLSPINSearch from "./pages/MLSPINSearch";
import ListingSearch from "./pages/ListingSearch";
import ListingSearchResults from "./pages/ListingSearchResults";

import SubmitClientNeed from "./pages/SubmitClientNeed";
import ClientNeedsDashboard from "./pages/ClientNeedsDashboard";
import CommunicationsFeed from "./pages/CommunicationsFeed";
// CommunicationCenter deleted - consolidated into ClientNeedsDashboard as "Communications Center"
import ListingIntel from "./pages/ListingIntel";
import AddListing from "./pages/AddListing";
import AddRentalListing from "./pages/AddRentalListing";
import PropertyDetail from "./pages/PropertyDetail";
import AgentDetailRedirect from "./pages/AgentDetailRedirect";
import ConsumerPropertyDetail from "./pages/ConsumerPropertyDetail";
import AgentProfileEditor from "./pages/AgentProfileEditor";
import ManageTeam from "./pages/ManageTeam";
import TeamProfile from "./pages/TeamProfile";
import TeamRequest from "./pages/TeamRequest";
import TeamInviteAccept from "./pages/TeamInviteAccept";
import AdminTeamApprovals from "./pages/AdminTeamApprovals";
import ManageCoverageAreas from "./pages/ManageCoverageAreas";
import BrowsePropertiesNew from "./pages/BrowsePropertiesNew";

import SearchResults from "./pages/SearchResults";


import PublicSearchResults from "./pages/PublicSearchResults";
import OurAgents from "./pages/OurAgents";
import PublicOurAgents from "./pages/PublicOurAgents";
import Favorites from "./pages/Favorites";
import BuyerFavorites from "./pages/BuyerFavorites";
import MyFavorites from "./pages/MyFavorites";
import HotSheets from "./pages/HotSheets";
import BuyerHotSheets from "./pages/BuyerHotSheets";
import HotSheetReview from "./pages/HotSheetReview";
import HotSheetBuyerDetail from "./pages/HotSheetBuyerDetail";
import MyClients from "./pages/MyClients";
import ClientHotSheet from "./pages/ClientHotSheet";
import ClientHotsheetPage from "./pages/ClientHotsheetPage";
import ClientInvitationSetup from "./pages/ClientInvitationSetup";
import AgentClientFavorites from "./pages/AgentClientFavorites";
import AgentBuyerNewMatches from "./pages/AgentBuyerNewMatches";
import ListingAnalytics from "./pages/ListingAnalytics";
import MarketInsights from "./pages/MarketInsights";
import VendorDashboard from "./pages/VendorDashboard";
import VendorSetup from "./pages/VendorSetup";
import VendorPackages from "./pages/VendorPackages";
import VendorDirectory from "./pages/VendorDirectory";
import PasswordReset from "./pages/PasswordReset";
import AgentAccountSetup from "./pages/AgentAccountSetup";
import ActivateAccount from "./pages/ActivateAccount";
import PendingVerification from "./pages/PendingVerification";
import NotFound from "./pages/NotFound";
import AccessError from "./pages/AccessError";
import MyListings from "./pages/MyListings";
import ManageListingPhotos from "./pages/ManageListingPhotos";
import AdminApprovals from "./pages/AdminApprovals";
import AdminDebugAuth from "./pages/AdminDebugAuth";
import AdminMatches from "./pages/AdminMatches";
import AdminConsumers from "./pages/AdminConsumers";
import AdminInviteAudit from "./pages/AdminInviteAudit";
import AdminEmailAnalytics from "./pages/AdminEmailAnalytics";
import AdminFounderInvite from "./pages/AdminFounderInvite";
import NetworkIntelligence from "./pages/NetworkIntelligence";

import ClientDashboard from "./pages/ClientDashboard";
import ClientAgentSettings from "./pages/ClientAgentSettings";
import BuyerMapSearch from "./pages/BuyerMapSearch";
import ClientCreateHotsheetNew from "./pages/ClientCreateHotsheetNew";
import ComingSoon from "./pages/ComingSoon";
import AllAgentConnectHome from "./pages/AllAgentConnectHome";
import ShareLinkHandler from "./pages/ShareLinkHandler";
import LandingPage from "./pages/LandingPage";
import AgentMatch from "./pages/AgentMatch";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import DesignMockup from "./pages/DesignMockup";
import HomepageV2 from "./pages/HomepageV2";
import AgentDiagnostics from "./pages/AgentDiagnostics";
import AcceptBuyerWorkspaceInvite from "./pages/AcceptBuyerWorkspaceInvite";
import AcceptDelegateInvite from "./pages/AcceptDelegateInvite";
import UnsubscribeHotSheet from "./pages/UnsubscribeHotSheet";
import HotSheetPreview from "./pages/HotSheetPreview";
import DraftListings from "./pages/DraftListings";
import AgentSettings from "./pages/AgentSettings";
import SellerListingDetail from "./pages/SellerListingDetail";
import IDXSearch from "./pages/IDXSearch";
import IDXSearchBeta from "./pages/IDXSearchBeta";
import IDXListingDetailBeta from "./pages/IDXListingDetailBeta";
import SellerDashboard from "./pages/SellerDashboard";
import ScrollToTop from "./components/ScrollToTop";
import ScrollRestoration from "./components/ScrollRestoration";
import VersionStamp from "./components/VersionStamp";
import { NewMessageToastListener } from "./components/NewMessageToastListener";
import CookieConsent from "./components/CookieConsent";

// Success Hub v2
import SuccessHubDashboard from "./pages/success-hub/SuccessHubDashboard";
import BuyersList from "./pages/success-hub/BuyersList";
import BuyerAccount from "./pages/success-hub/BuyerAccount";
import ListingsList from "./pages/success-hub/ListingsList";
import ListingPerformance from "./pages/success-hub/ListingPerformance";
// Legal pages
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import AgentNetworkRules from "./pages/legal/AgentNetworkRules";
import CookiePolicy from "./pages/legal/CookiePolicy";
import FairHousing from "./pages/legal/FairHousing";
import Disclosures from "./pages/legal/Disclosures";

// Messaging
// Legacy messaging pages (kept for rollback)
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import MessagingWorkspace from "./pages/MessagingWorkspace";
import BuyerMessagingWorkspace from "./pages/BuyerMessagingWorkspace";
import PublicAgentProfile from "./pages/PublicAgentProfile";
import Footer from "./components/Footer";
import { AuthRoleProvider, useAuthRole } from "./hooks/useAuthRole";
import { LoadingScreen } from "./components/LoadingScreen";
import { Skeleton } from "./components/ui/skeleton";
import { SharedListingGuestProvider } from "./contexts/SharedListingGuestContext";
import { SharedListingGate } from "./components/SharedListingGate";

/** Legacy `/dashboard` → role-appropriate home (buyers must land on `/client/dashboard`). */
function LegacyDashboardRedirect() {
  const { role, loading } = useAuthRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role === "admin") {
      navigate("/admin/approvals", { replace: true });
    } else if (role === "agent" || role === "delegate") {
      navigate("/agent-dashboard", { replace: true });
    } else if (role === "buyer") {
      navigate("/client/dashboard", { replace: true });
    } else {
      navigate("/auth", { replace: true });
    }
  }, [loading, role, navigate]);

  if (loading) {
    return <LoadingScreen message="Redirecting..." />;
  }
  return null;
}

// Legacy redirect for /client-hot-sheet/:token → /client/hotsheet/:token
function LegacyClientHotSheetRedirect() {
  const { token } = useParams();
  const location = useLocation();
  return <Navigate to={`/client/hotsheet/${token}${location.search}`} replace />;
}

/** Legacy `/success-hub/buyers*` → agent buyers workspace (dashboard sidebar “Buyers”). */
function LegacySuccessHubBuyersToAgentBuyers() {
  const { search } = useLocation();
  return <Navigate to={`/agent/buyers${search}`} replace />;
}

function LegacySuccessHubBuyerFavoritesToAgent() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const { search } = useLocation();
  return <Navigate to={`/agent/buyers/${buyerId ?? ""}/favorites${search}`} replace />;
}

function LegacySuccessHubBuyerAccountToAgent() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const { search } = useLocation();
  return <Navigate to={`/agent/buyers/${buyerId ?? ""}${search}`} replace />;
}

/**
 * Normalizes `/agent/buyers/buyers/:buyerId` → `/agent/buyers/:buyerId`.
 * A relative `buyers/<id>` from `/agent/buyers` resolves to an extra `buyers/` segment, which
 * does not match `/agent/buyers/:buyerId` (single param) and would otherwise hit `*` → 404.
 */
function AgentBuyersDoubleSegmentRedirect() {
  const { buyerId } = useParams<{ buyerId: string }>();
  const { search } = useLocation();
  return <Navigate to={`/agent/buyers/${buyerId ?? ""}${search}`} replace />;
}

function FavoritesEntry() {
  const { user, role, loading } = useAuthRole();
  // Wait while auth is loading OR while we have a user but role hasn't resolved yet.
  // Without this, a transient `role === null` redirects an authenticated user to /auth on hard refresh.
  if (loading || (user && !role)) {
    return (
      <div className="flex min-h-screen flex-col bg-white" aria-busy="true">
        <div className="border-b border-neutral-200 px-5 py-3 md:px-7">
          <Skeleton className="h-8 w-[min(100%,20rem)] max-w-xl rounded-md bg-neutral-100" />
        </div>
        <div className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-1 gap-4 p-5 md:p-7 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)]">
          <Skeleton className="min-h-[45vh] rounded-2xl border border-neutral-100 bg-neutral-100 lg:min-h-[calc(100dvh-9rem)]" />
          <Skeleton className="min-h-[38vh] rounded-2xl border border-neutral-100 bg-neutral-100 lg:min-h-[calc(100dvh-9rem)]" />
        </div>
      </div>
    );
  }
  if (role === "agent" || role === "admin") return <Navigate to="/my-favorites" replace />;
  if (role === "buyer") return <BuyerFavorites />;
  return <Navigate to="/auth" replace />;
}

function HotSheetsEntry() {
  const { role, loading } = useAuthRole();
  if (loading) return null;
  if (role === "agent" || role === "admin") return <Navigate to="/agent/hot-sheets" replace />;
  if (role === "buyer") return <BuyerHotSheets />;
  return <Navigate to="/auth" replace />;
}

function MessagesEntry() {
  const { role, loading } = useAuthRole();
  const { id } = useParams();
  const location = useLocation();
  if (loading) return null;
  if (role === "agent" || role === "admin") {
    return (
      <Navigate
        to={`/agent/messages${id ? `/${id}` : ""}${location.search}`}
        replace
        state={location.state}
      />
    );
  }
  if (role === "buyer") return <BuyerMessagingWorkspace />;
  return <Navigate to="/auth" replace />;
}

function BrowseEntry() {
  const { role, loading } = useAuthRole();
  if (loading) return null;
  if (role === "buyer") return <Navigate to="/client/search" replace />;
  return <BrowsePropertiesNew />;
}

/** Layout route: wraps children in AppShell (sidebar + header) */
function AgentLayout() {
  return <AppShell><Outlet /></AppShell>;
}

/** Layout route: wraps buyer-authenticated pages in BuyerShell */
function BuyerLayout() {
  return <BuyerShell />;
}

/** Layout route: AAC public/auth pages — white canvas only (no top nav; brand lives in each page) */
function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Outlet />
    </div>
  );
}

/**
 * Property detail is public, but signed-in agents/admins get AppShell so the
 * collapsed icon rail appears on listing workspace pages.
 */
function PropertyDetailShell() {
  const { role, loading, user } = useAuthRole();

  if (loading && user) {
    return <LoadingScreen message="Loading..." />;
  }

  if (role === "agent" || role === "admin") {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  return <Outlet />;
}


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
            <AuthRoleProvider>
            <SharedListingGuestProvider>
            <Sonner />
            <ScrollToTop />
            <ScrollRestoration />
            <>
              <NewMessageToastListener />
              <CrossTabSessionGuard />
              <SharedListingGate>
              <Routes>
                <Route path="/" element={<HomepageV2 />} />
                <Route path="/index" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/request-access" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/agent-match" element={<><AgentMatch /><Footer /></>} />
                <Route path="/seller-listing/:id" element={<SellerListingDetail />} />
                <Route path="/seller/dashboard" element={<SellerDashboard />} />
                <Route path="/home" element={<Index />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/blog" element={<Blog />} />
                {/* Auth routes */}
                <Route element={<PublicLayout />}>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/setup" element={<AuthSetupRedirect />} />
                  <Route path="/auth/diagnostics" element={<AuthDiagnostics />} />
                  <Route path="/pending-verification" element={<PendingVerification />} />
                  <Route path="/password-reset" element={<PasswordReset />} />
                  <Route path="/agent-setup" element={<AgentAccountSetup />} />
                  <Route path="/activate" element={<ActivateAccount />} />
                  <Route path="/access-error" element={<AccessError />} />
                </Route>
                
                {/* Legacy redirects - all go to /auth */}
                <Route path="/choose" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/get-started" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/onboarding" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/onboarding/create-account" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/onboarding/verify-license" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/verify-agent" element={<Navigate to="/auth?mode=register" replace />} />
                
                {/* Legacy route redirect */}
                <Route path="/allagentconnect" element={<Navigate to="/agent-dashboard" replace />} />
                
                {/* Agent routes wrapped in AppShell via layout route */}
                <Route element={<AgentLayout />}>
                  <Route path="/agent-dashboard" element={<RouteGuard requireRole="agent"><SuccessHubDashboard /></RouteGuard>} />
                  <Route path="/agent-dashboard-v2" element={<Navigate to="/agent-dashboard" replace />} />
                  <Route path="/success-hub" element={<Navigate to="/agent-dashboard" replace />} />
                  <Route path="/agent/buyers" element={<RouteGuard requireRole="agent"><BuyersList /></RouteGuard>} />
                  <Route
                    path="/agent/buyers/buyers/:buyerId"
                    element={
                      <RouteGuard requireRole="agent">
                        <AgentBuyersDoubleSegmentRedirect />
                      </RouteGuard>
                    }
                  />
                  <Route
                    path="/agent/buyers/:buyerId/favorites"
                    element={<RouteGuard requireRole="agent"><AgentClientFavorites /></RouteGuard>}
                  />
                  <Route
                    path="/agent/buyers/:buyerId/new-matches"
                    element={<RouteGuard requireRole="agent"><AgentBuyerNewMatches /></RouteGuard>}
                  />
                  <Route path="/agent/buyers/:buyerId" element={<RouteGuard requireRole="agent"><BuyerAccount /></RouteGuard>} />
                  <Route path="/success-hub/buyers" element={<LegacySuccessHubBuyersToAgentBuyers />} />
                  <Route path="/success-hub/buyers/:buyerId/favorites" element={<LegacySuccessHubBuyerFavoritesToAgent />} />
                  <Route path="/success-hub/buyers/:buyerId" element={<LegacySuccessHubBuyerAccountToAgent />} />
                  <Route path="/success-hub/listings" element={<RouteGuard requireRole="agent"><ListingsList /></RouteGuard>} />
                  <Route path="/success-hub/listings/:listingId" element={<RouteGuard requireRole="agent"><ListingPerformance /></RouteGuard>} />
                  <Route path="/communications" element={<RouteGuard requireRole="agent"><ClientNeedsDashboard /></RouteGuard>} />
                  <Route path="/communications/feed" element={<RouteGuard requireRole="agent"><CommunicationsFeed /></RouteGuard>} />

                  <Route path="/agent/listings" element={<RouteGuard requireRole="agent"><MyListings /></RouteGuard>} />
                  <Route path="/agent/listings/drafts" element={<RouteGuard requireRole="agent"><DraftListings /></RouteGuard>} />
                  <Route path="/agent/listings/new" element={<RouteGuard requireRole="agent"><AddListing /></RouteGuard>} />
                  <Route path="/agent/listings/:id/photos" element={<RouteGuard requireRole="agent"><ManageListingPhotos /></RouteGuard>} />
                  <Route path="/agent/listings/:id/floor-plans" element={<RouteGuard requireRole="agent"><ManageListingPhotos mode="floorPlans" /></RouteGuard>} />
                  <Route path="/agent/listings/edit/:id" element={<RouteGuard requireRole="agent"><AddListing /></RouteGuard>} />
                  <Route path="/agent/listings/:id" element={<RouteGuard requireRole="agent"><AgentDetailRedirect /></RouteGuard>} />
                  <Route path="/client-needs" element={<RouteGuard requireRole="agent"><ClientNeedsDashboard /></RouteGuard>} />
                  <Route path="/listing-intel" element={<RouteGuard requireRole="agent"><ListingIntel /></RouteGuard>} />
                  <Route path="/agent/diagnostics" element={<RouteGuard requireRole="agent"><AgentDiagnostics /></RouteGuard>} />
                  <Route path="/add-rental-listing" element={<RouteGuard requireRole="agent"><AddRentalListing /></RouteGuard>} />
                  <Route path="/agent/profile" element={<RouteGuard requireRole="agent"><AgentProfileEditor /></RouteGuard>} />
                  <Route path="/agent-profile-editor" element={<RouteGuard requireRole="agent"><AgentProfileEditor /></RouteGuard>} />
                  <Route path="/manage-team" element={<RouteGuard requireRole="agent"><ManageTeam /></RouteGuard>} />
                  <Route path="/team/:id/manage" element={<RouteGuard requireRole="agent"><ManageTeam /></RouteGuard>} />
                  <Route path="/team/request" element={<RouteGuard requireRole="agent"><TeamRequest /></RouteGuard>} />
                  <Route path="/team/invite/:token" element={<RouteGuard requireAuth><TeamInviteAccept /></RouteGuard>} />
                  <Route path="/admin/team-approvals" element={<AdminTeamApprovals />} />
                  <Route path="/manage-coverage-areas" element={<RouteGuard requireRole="agent"><ManageCoverageAreas /></RouteGuard>} />
                  <Route path="/our-members" element={<RouteGuard requireRole="agent"><OurAgents defaultAgentMode={true} isAgentMode /></RouteGuard>} />
                  <Route path="/members" element={<RouteGuard requireRole="agent"><OurAgents defaultAgentMode={true} isAgentMode /></RouteGuard>} />
                  <Route path="/listing-search" element={<RouteGuard requireRole="agent"><ListingSearch /></RouteGuard>} />
                  <Route path="/listing-results" element={<RouteGuard requireRole="agent"><ListingSearchResults /></RouteGuard>} />
                  <Route path="/agent-search" element={<MLSPINSearch />} />
                  <Route path="/my-favorites" element={<RouteGuard requireRole={["agent", "admin"]}><MyFavorites /></RouteGuard>} />
                  <Route path="/agent/hot-sheets" element={<RouteGuard requireRole="agent"><HotSheets isAgentMode /></RouteGuard>} />
                  <Route path="/agent/off-market" element={<Navigate to="/agent/listings?status=off_market" replace />} />
                  <Route path="/hot-sheets/:id/review" element={<RouteGuard requireRole="agent"><HotSheetReview /></RouteGuard>} />
                  <Route path="/hot-sheets/buyer/:clientId" element={<RouteGuard requireRole="agent"><HotSheetBuyerDetail /></RouteGuard>} />
                  <Route path="/my-clients" element={<RouteGuard requireRole="agent"><MyClients /></RouteGuard>} />
                  <Route path="/my-clients/:clientId/favorites" element={<RouteGuard requireRole="agent"><AgentClientFavorites /></RouteGuard>} />
                  <Route path="/agent/favorites" element={<Navigate to="/my-favorites" replace />} />
                  <Route path="/agent/messages" element={<RouteGuard requireRole="agent"><MessagingWorkspace isAgentMode /></RouteGuard>} />
                  <Route path="/agent/messages/:id" element={<RouteGuard requireRole="agent"><MessagingWorkspace isAgentMode /></RouteGuard>} />
                  <Route path="/showing-requests" element={<RouteGuard requireRole="agent"><ShowingRequests /></RouteGuard>} />
                  <Route path="/analytics" element={<RouteGuard requireRole="agent"><ListingAnalytics /></RouteGuard>} />
                  <Route path="/analytics/:id" element={<RouteGuard requireRole="agent"><ListingAnalytics /></RouteGuard>} />
                  <Route path="/market-insights" element={<RouteGuard requireRole="agent"><MarketInsights /></RouteGuard>} />
                  <Route path="/vendor/dashboard" element={<RouteGuard requireRole="agent"><VendorDashboard /></RouteGuard>} />
                  <Route path="/vendor/setup" element={<RouteGuard requireRole="agent"><VendorSetup /></RouteGuard>} />
                  <Route path="/vendor/packages" element={<RouteGuard requireRole="agent"><VendorPackages /></RouteGuard>} />
                  <Route path="/vendor/directory" element={<RouteGuard requireRole="agent"><VendorDirectory /></RouteGuard>} />
                  <Route path="/admin/approvals" element={<AdminApprovals />} />
                  <Route path="/admin/matches" element={<AdminMatches />} />
                  <Route path="/admin/consumers" element={<AdminConsumers />} />
                  <Route path="/admin/invites" element={<AdminInviteAudit />} />
                  <Route path="/admin/email-analytics" element={<AdminEmailAnalytics />} />
                  <Route path="/admin/founder-invite" element={<AdminFounderInvite />} />
                  <Route path="/admin/debug-auth" element={<AdminDebugAuth />} />
                  <Route path="/settings" element={<RouteGuard requireRole="agent"><AgentSettings /></RouteGuard>} />
                </Route>
                {/* Buyer authenticated routes — wrapped in BuyerShell */}
                <Route element={<BuyerLayout />}>
                  <Route
                    path="/client/search"
                    element={import.meta.env.DEV ? <BuyerMapSearch /> : <RouteGuard requireAuth><BuyerMapSearch /></RouteGuard>}
                  />
                  <Route path="/client/dashboard" element={<RouteGuard requireAuth><ClientDashboard /></RouteGuard>} />
                  <Route path="/client/account" element={<RouteGuard requireAuth><ClientAgentSettings /></RouteGuard>} />
                  <Route path="/favorites" element={<RouteGuard requireAuth><FavoritesEntry /></RouteGuard>} />
                  <Route path="/hot-sheets" element={<RouteGuard requireAuth><HotSheetsEntry /></RouteGuard>} />
                  <Route path="/hot-sheets/new" element={<RouteGuard requireRole="buyer"><ClientCreateHotsheetNew /></RouteGuard>} />
                  <Route path="/messages" element={<RouteGuard requireAuth><MessagesEntry /></RouteGuard>} />
                  <Route path="/messages/:id" element={<RouteGuard requireAuth><MessagesEntry /></RouteGuard>} />
                  <Route path="/consumer-property/:id" element={<ConsumerPropertyDetail />} />
                  <Route path="/client/hot-sheets/:id" element={<ClientHotsheetPage />} />
                </Route>

                {/* Public routes outside AppShell */}
                <Route path="/buyer/auth" element={<Navigate to="/auth" replace />} />
                <Route path="/submit-client-need" element={<SubmitClientNeed />} />
                <Route path="/communication-center" element={<Navigate to="/communications" replace />} />
                <Route element={<PropertyDetailShell />}>
                  <Route path="/property/:id" element={<PropertyDetail />} />
                </Route>
                <Route path="/team/:id" element={<TeamProfile />} />
                <Route path="/browse" element={<BrowseEntry />} />
                <Route path="/dashboard" element={<LegacyDashboardRedirect />} />
                <Route path="/search" element={<PublicSearchResults />} />
                <Route path="/our-agents" element={<PublicOurAgents />} />
                <Route path="/agents" element={<PublicOurAgents />} />
                <Route path="/find-agent" element={<PublicOurAgents />} />
                <Route path="/agent/:id" element={<PublicAgentProfile />} />
                <Route path="/client-invite" element={<ClientInvitationSetup />} />
                {/* Clean opaque-token invite URL — used by hot sheet / buyer workspace invitation emails */}
                <Route path="/invite/:token" element={<ClientInvitationSetup />} />
                <Route path="/client-hot-sheet/:token" element={<LegacyClientHotSheetRedirect />} />
                <Route path="/client/hotsheet/:token" element={<ClientHotsheetPage />} />
                {/* Legacy consumer routes */}
                <Route path="/consumer/home" element={<Navigate to="/auth" replace />} />
                <Route path="/consumer/dashboard" element={<Navigate to="/auth" replace />} />
                <Route path="/consumer/auth" element={<Navigate to="/auth" replace />} />
                <Route path="/client-agent-settings" element={<Navigate to="/client/account" replace />} />
                <Route path="/client/hotsheets/new" element={<Navigate to="/hot-sheets/new" replace />} />
                <Route path="/client/create-hotsheet" element={<Navigate to="/hot-sheets/new" replace />} />
                <Route path="/client/hot-sheets" element={<Navigate to="/hot-sheets" replace />} />
                <Route path="/client/favorites" element={<Navigate to="/favorites" replace />} />
                <Route path="/accept-buyer-workspace-invite" element={<AcceptBuyerWorkspaceInvite />} />
                <Route path="/accept-delegate-invite" element={<AcceptDelegateInvite />} />
                <Route path="/unsubscribe-hotsheet" element={<UnsubscribeHotSheet />} />
                <Route path="/hotsheet-preview" element={<HotSheetPreview />} />
                <Route path="/link/:token" element={<ShareLinkHandler />} />
                {/* Legal pages */}
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/agent-rules" element={<AgentNetworkRules />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/fair-housing" element={<FairHousing />} />
                <Route path="/disclosures" element={<Disclosures />} />
                <Route path="/mockup" element={<DesignMockup />} />
                <Route path="/homepage-v2" element={<HomepageV2 />} />
                {/* IDX Routes */}
                <Route path="/idx" element={<IDXSearchBeta />} />
                <Route path="/idx/:mlsNumber" element={<IDXListingDetailBeta />} />
                <Route path="/idx/search" element={<IDXSearch />} />
                <Route path="/idx/property/:mlsNumber" element={<IDXListingDetailBeta />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </SharedListingGate>
              <CookieConsent />
            </>
            </SharedListingGuestProvider>
            </AuthRoleProvider>
          </TooltipProvider>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;

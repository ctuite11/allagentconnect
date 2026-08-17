

import React, { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, Outlet, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";

// Phase 3: keep authenticated/layout chrome out of the homepage main chunk.
const AppShell = React.lazy(() =>
  import("@/components/layout/AppShell").then((m) => ({ default: m.AppShell })),
);
const BuyerShell = React.lazy(() =>
  import("@/components/layout/BuyerShell").then((m) => ({ default: m.BuyerShell })),
);
const CrossTabSessionGuard = React.lazy(() =>
  import("@/components/CrossTabSessionGuard").then((m) => ({ default: m.CrossTabSessionGuard })),
);
const NewMessageToastListener = React.lazy(() =>
  import("@/components/NewMessageToastListener").then((m) => ({ default: m.NewMessageToastListener })),
);
const Index = React.lazy(() => import("./pages/Index"));
const Footer = React.lazy(() => import("./components/Footer"));
const CookieConsent = React.lazy(() => import("./components/CookieConsent"));
const RouteGuard = React.lazy(() =>
  import("./components/RouteGuard").then((m) => ({ default: m.RouteGuard })),
);

const Auth = React.lazy(() => import("./pages/Auth"));
const AuthCallback = React.lazy(() => import("./pages/AuthCallback"));
const AuthDiagnostics = React.lazy(() => import("./pages/AuthDiagnostics"));
const AuthSetupRedirect = React.lazy(() => import("./pages/AuthSetupRedirect"));
// AgentSuccessHub archived → AgentSuccessHub.legacy.tsx
const AgentSuccessHub = React.lazy(() => import("./pages/AgentSuccessHub.legacy"));
const ShowingRequests = React.lazy(() => import("./pages/ShowingRequests"));

const MLSPINSearch = React.lazy(() => import("./pages/MLSPINSearch"));
const ListingSearch = React.lazy(() => import("./pages/ListingSearch"));
const ListingSearchResults = React.lazy(() => import("./pages/ListingSearchResults"));

// SubmitClientNeed retired — the standalone page inserted directly into
// client_needs and triggered a second network email campaign. The canonical
// path is the Communications Center Buyer Need compose flow.
import { BUYER_NEED_COMPOSE_ROUTE } from "@/lib/buyerNeedCompose";
const ClientNeedsDashboard = React.lazy(() => import("./pages/ClientNeedsDashboard"));
const CommunicationsFeed = React.lazy(() => import("./pages/CommunicationsFeed"));
// CommunicationCenter deleted - consolidated into ClientNeedsDashboard as "Communications Center"
const ListingIntel = React.lazy(() => import("./pages/ListingIntel"));
const AddListing = React.lazy(() => import("./pages/AddListing"));
const AddRentalListing = React.lazy(() => import("./pages/AddRentalListing"));
const PropertyDetail = React.lazy(() => import("./pages/PropertyDetail"));
const AgentDetailRedirect = React.lazy(() => import("./pages/AgentDetailRedirect"));
const ConsumerPropertyDetail = React.lazy(() => import("./pages/ConsumerPropertyDetail"));
const AgentProfileEditor = React.lazy(() => import("./pages/AgentProfileEditor"));
const ManageTeam = React.lazy(() => import("./pages/ManageTeam"));
const TeamProfile = React.lazy(() => import("./pages/TeamProfile"));
const TeamRequest = React.lazy(() => import("./pages/TeamRequest"));
const TeamInviteAccept = React.lazy(() => import("./pages/TeamInviteAccept"));
const AdminTeamApprovals = React.lazy(() => import("./pages/AdminTeamApprovals"));
const ManageCoverageAreas = React.lazy(() => import("./pages/ManageCoverageAreas"));
const BrowsePropertiesNew = React.lazy(() => import("./pages/BrowsePropertiesNew"));

const SearchResults = React.lazy(() => import("./pages/SearchResults"));


const PublicSearchResults = React.lazy(() => import("./pages/PublicSearchResults"));
const OurAgents = React.lazy(() => import("./pages/OurAgents"));
const PublicOurAgents = React.lazy(() => import("./pages/PublicOurAgents"));
const Favorites = React.lazy(() => import("./pages/Favorites"));
const BuyerFavorites = React.lazy(() => import("./pages/BuyerFavorites"));
const MyFavorites = React.lazy(() => import("./pages/MyFavorites"));
const HotSheets = React.lazy(() => import("./pages/HotSheets"));
const BuyerHotSheets = React.lazy(() => import("./pages/BuyerHotSheets"));
const HotSheetReview = React.lazy(() => import("./pages/HotSheetReview"));
const HotSheetBuyerDetail = React.lazy(() => import("./pages/HotSheetBuyerDetail"));
const MyClients = React.lazy(() => import("./pages/MyClients"));
const ClientHotSheet = React.lazy(() => import("./pages/ClientHotSheet"));
const ClientHotsheetPage = React.lazy(() => import("./pages/ClientHotsheetPage"));
const ClientInvitationSetup = React.lazy(() => import("./pages/ClientInvitationSetup"));
const AgentClientFavorites = React.lazy(() => import("./pages/AgentClientFavorites"));
const AgentBuyerNewMatches = React.lazy(() => import("./pages/AgentBuyerNewMatches"));
const ListingAnalytics = React.lazy(() => import("./pages/ListingAnalytics"));
const MarketInsights = React.lazy(() => import("./pages/MarketInsights"));
const VendorDashboard = React.lazy(() => import("./pages/VendorDashboard"));
const VendorSetup = React.lazy(() => import("./pages/VendorSetup"));
const VendorPackages = React.lazy(() => import("./pages/VendorPackages"));
const VendorDirectory = React.lazy(() => import("./pages/VendorDirectory"));
const DevelopmentsBrowsePage = React.lazy(() => import("./pages/developments/DevelopmentsBrowsePage"));
const DevelopmentLayout = React.lazy(() =>
  import("./components/developments/DevelopmentLayout").then((m) => ({ default: m.DevelopmentLayout })),
);
const DevelopmentOverviewPage = React.lazy(() => import("./pages/developments/DevelopmentOverviewPage"));
const DevelopmentFloorPlansPage = React.lazy(() => import("./pages/developments/DevelopmentFloorPlansPage"));
const DevelopmentUnitsPage = React.lazy(() => import("./pages/developments/DevelopmentUnitsPage"));
const DevelopmentUnitDetailPage = React.lazy(() => import("./pages/developments/DevelopmentUnitDetailPage"));
const DevelopmentDocumentsPage = React.lazy(() => import("./pages/developments/DevelopmentDocumentsPage"));
const DevelopmentUpdatesPage = React.lazy(() => import("./pages/developments/DevelopmentUpdatesPage"));
const DevelopmentsVisualPreview = import.meta.env.DEV
  ? React.lazy(() => import("./pages/developments/DevelopmentsVisualPreview"))
  : null;
const DeveloperDashboardPage = React.lazy(() => import("./pages/developer/DeveloperDashboardPage"));
const DeveloperCreateDevelopmentPage = React.lazy(
  () => import("./pages/developer/DeveloperCreateDevelopmentPage"),
);
const DeveloperDevelopmentLayout = React.lazy(() =>
  import("./components/developments/DeveloperDevelopmentLayout").then((m) => ({
    default: m.DeveloperDevelopmentLayout,
  })),
);
const DeveloperDetailsPage = React.lazy(() => import("./pages/developer/DeveloperDetailsPage"));
const DeveloperPhotosPage = React.lazy(() => import("./pages/developer/DeveloperPhotosPage"));
const DeveloperFloorPlansManagePage = React.lazy(
  () => import("./pages/developer/DeveloperFloorPlansPage"),
);
const DeveloperUnitsManagePage = React.lazy(() => import("./pages/developer/DeveloperUnitsPage"));
const DeveloperDocumentsManagePage = React.lazy(
  () => import("./pages/developer/DeveloperDocumentsPage"),
);
const DeveloperUpdatesManagePage = React.lazy(() => import("./pages/developer/DeveloperUpdatesPage"));
const DeveloperTeamPage = React.lazy(() => import("./pages/developer/DeveloperTeamPage"));
const AdminDevelopmentsListPage = React.lazy(() =>
  import("./pages/admin/AdminDevelopmentsPages").then((m) => ({ default: m.AdminDevelopmentsListPage })),
);
const AdminDevelopmentReviewPage = React.lazy(() =>
  import("./pages/admin/AdminDevelopmentsPages").then((m) => ({ default: m.AdminDevelopmentReviewPage })),
);
const PasswordReset = React.lazy(() => import("./pages/PasswordReset"));
const AgentAccountSetup = React.lazy(() => import("./pages/AgentAccountSetup"));
const ActivateAccount = React.lazy(() => import("./pages/ActivateAccount"));
const SignInLink = React.lazy(() => import("./pages/SignInLink"));
const PendingVerification = React.lazy(() => import("./pages/PendingVerification"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const AccessError = React.lazy(() => import("./pages/AccessError"));
const MyListings = React.lazy(() => import("./pages/MyListings"));
const ManageListingPhotos = React.lazy(() => import("./pages/ManageListingPhotos"));
const AdminApprovals = React.lazy(() => import("./pages/AdminApprovals"));
const AdminDebugAuth = React.lazy(() => import("./pages/AdminDebugAuth"));
const AdminMatches = React.lazy(() => import("./pages/AdminMatches"));
const AdminConsumers = React.lazy(() => import("./pages/AdminConsumers"));
const AdminInviteAudit = React.lazy(() => import("./pages/AdminInviteAudit"));
const AdminEmailAnalytics = React.lazy(() => import("./pages/AdminEmailAnalytics"));
const AdminFounderInvite = React.lazy(() => import("./pages/AdminFounderInvite"));
const NetworkIntelligence = React.lazy(() => import("./pages/NetworkIntelligence"));

const ClientDashboard = React.lazy(() => import("./pages/ClientDashboard"));
const ClientAgentSettings = React.lazy(() => import("./pages/ClientAgentSettings"));
const BuyerMapSearch = React.lazy(() => import("./pages/BuyerMapSearch"));
const ClientCreateHotsheetNew = React.lazy(() => import("./pages/ClientCreateHotsheetNew"));
const ComingSoon = React.lazy(() => import("./pages/ComingSoon"));
const AllAgentConnectHome = React.lazy(() => import("./pages/AllAgentConnectHome"));
const ShareLinkHandler = React.lazy(() => import("./pages/ShareLinkHandler"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const AgentMatch = React.lazy(() => import("./pages/AgentMatch"));
const About = React.lazy(() => import("./pages/About"));
const Contact = React.lazy(() => import("./pages/Contact"));
const Blog = React.lazy(() => import("./pages/Blog"));
const DesignMockup = React.lazy(() => import("./pages/DesignMockup"));
// Eager: ~9 KB / ~3 KB gzip — removes Suspense waterfall on `/` after main evaluates.
import HomepageV2 from "./pages/HomepageV2";
const AgentDiagnostics = React.lazy(() => import("./pages/AgentDiagnostics"));
const AcceptBuyerWorkspaceInvite = React.lazy(() => import("./pages/AcceptBuyerWorkspaceInvite"));
const AcceptDelegateInvite = React.lazy(() => import("./pages/AcceptDelegateInvite"));
const UnsubscribeHotSheet = React.lazy(() => import("./pages/UnsubscribeHotSheet"));
const HotSheetPreview = React.lazy(() => import("./pages/HotSheetPreview"));
const DraftListings = React.lazy(() => import("./pages/DraftListings"));
const AgentSettings = React.lazy(() => import("./pages/AgentSettings"));
const SellerListingDetail = React.lazy(() => import("./pages/SellerListingDetail"));
const IDXSearch = React.lazy(() => import("./pages/IDXSearch"));
const IDXSearchBeta = React.lazy(() => import("./pages/IDXSearchBeta"));
const IDXListingDetailBeta = React.lazy(() => import("./pages/IDXListingDetailBeta"));
const SellerDashboard = React.lazy(() => import("./pages/SellerDashboard"));
import ScrollToTop from "./components/ScrollToTop";
import ScrollRestoration from "./components/ScrollRestoration";

// Success Hub v2
const SuccessHubDashboard = React.lazy(() => import("./pages/success-hub/SuccessHubDashboard"));
const BuyersList = React.lazy(() => import("./pages/success-hub/BuyersList"));
const BuyerAccount = React.lazy(() => import("./pages/success-hub/BuyerAccount"));
const ListingsList = React.lazy(() => import("./pages/success-hub/ListingsList"));
const ListingPerformance = React.lazy(() => import("./pages/success-hub/ListingPerformance"));
// Legal pages
const PrivacyPolicy = React.lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = React.lazy(() => import("./pages/legal/TermsOfService"));
const AgentNetworkRules = React.lazy(() => import("./pages/legal/AgentNetworkRules"));
const CookiePolicy = React.lazy(() => import("./pages/legal/CookiePolicy"));
const FairHousing = React.lazy(() => import("./pages/legal/FairHousing"));
const Disclosures = React.lazy(() => import("./pages/legal/Disclosures"));

// Messaging
// Legacy messaging pages (kept for rollback)
const Messages = React.lazy(() => import("./pages/Messages"));
const Conversation = React.lazy(() => import("./pages/Conversation"));
const MessagingWorkspace = React.lazy(() => import("./pages/MessagingWorkspace"));
const BuyerMessagingWorkspace = React.lazy(() => import("./pages/BuyerMessagingWorkspace"));
const PublicAgentProfile = React.lazy(() => import("./pages/PublicAgentProfile"));
import { AuthRoleProvider, useAuthRole } from "./hooks/useAuthRole";
import { LoadingScreen } from "./components/LoadingScreen";
import { Skeleton } from "./components/ui/skeleton";
import { SharedListingGuestProvider } from "./contexts/SharedListingGuestContext";
import { SharedListingGate } from "./components/SharedListingGate";
import { decideLegacyDashboardRoute } from "./lib/legacyDashboardRoute";

/** Legacy `/dashboard` → role-appropriate home (buyers must land on `/client/dashboard`). */
function LegacyDashboardRedirect() {
  const { user, role, loading } = useAuthRole();
  const navigate = useNavigate();
  const decision = decideLegacyDashboardRoute({
    userPresent: Boolean(user),
    role,
    loading,
  });

  useEffect(() => {
    if (decision.status === "redirect") {
      navigate(decision.target, { replace: true });
    }
  }, [decision, navigate]);

  return decision.status === "loading"
    ? <LoadingScreen message="Checking your session..." />
    : null;
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
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <AppShell>
        <Outlet />
      </AppShell>
    </React.Suspense>
  );
}

/** Layout route: wraps buyer-authenticated pages in BuyerShell */
function BuyerLayout() {
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <BuyerShell />
    </React.Suspense>
  );
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
      <React.Suspense fallback={<LoadingScreen message="Loading..." />}>
        <AppShell>
          <Outlet />
        </AppShell>
      </React.Suspense>
    );
  }

  return <Outlet />;
}

/** Message toasts + cross-tab session guard — only when a session exists. */
function AuthenticatedSessionChrome() {
  const { user } = useAuthRole();
  if (!user) return null;
  return (
    <React.Suspense fallback={null}>
      <NewMessageToastListener />
      <CrossTabSessionGuard />
    </React.Suspense>
  );
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
              <AuthenticatedSessionChrome />
              <SharedListingGate>
              <React.Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<HomepageV2 />} />
                <Route path="/index" element={<Navigate to="/" replace />} />
                <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
                <Route path="/request-access" element={<Navigate to="/auth?mode=register" replace />} />
                <Route
                  path="/agent-match"
                  element={
                    <>
                      <AgentMatch />
                      <React.Suspense fallback={null}>
                        <Footer />
                      </React.Suspense>
                    </>
                  }
                />
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
                  <Route path="/signin-link" element={<SignInLink />} />
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

                  {/* New Developments — agent-facing Phase 1 */}
                  <Route path="/developments" element={<RouteGuard requireRole="agent"><DevelopmentsBrowsePage /></RouteGuard>} />
                  <Route
                    path="/developments/:slug"
                    element={
                      <RouteGuard requireRole="agent">
                        <DevelopmentLayout />
                      </RouteGuard>
                    }
                  >
                    <Route index element={<DevelopmentOverviewPage />} />
                    <Route path="floor-plans" element={<DevelopmentFloorPlansPage />} />
                    <Route path="units" element={<DevelopmentUnitsPage />} />
                    <Route path="units/:unitId" element={<DevelopmentUnitDetailPage />} />
                    <Route path="documents" element={<DevelopmentDocumentsPage />} />
                    <Route path="updates" element={<DevelopmentUpdatesPage />} />
                  </Route>
                  {import.meta.env.DEV && DevelopmentsVisualPreview ? (
                    <Route path="/dev/developments-preview" element={<DevelopmentsVisualPreview />} />
                  ) : null}

                  {/* New Developments — Phase 2 developer workspace */}
                  <Route path="/developer" element={<RouteGuard requireAuth><DeveloperDashboardPage /></RouteGuard>} />
                  <Route
                    path="/developer/developments/new"
                    element={<RouteGuard requireAuth><DeveloperCreateDevelopmentPage /></RouteGuard>}
                  />
                  <Route
                    path="/developer/developments/:developmentId"
                    element={
                      <RouteGuard requireAuth>
                        <DeveloperDevelopmentLayout />
                      </RouteGuard>
                    }
                  >
                    <Route index element={<DeveloperDetailsPage />} />
                    <Route path="photos" element={<DeveloperPhotosPage />} />
                    <Route path="floor-plans" element={<DeveloperFloorPlansManagePage />} />
                    <Route path="units" element={<DeveloperUnitsManagePage />} />
                    <Route path="documents" element={<DeveloperDocumentsManagePage />} />
                    <Route path="updates" element={<DeveloperUpdatesManagePage />} />
                    <Route path="team" element={<DeveloperTeamPage />} />
                  </Route>

                  <Route path="/admin/approvals" element={<AdminApprovals />} />
                  <Route path="/admin/developments" element={<RouteGuard requireRole="admin"><AdminDevelopmentsListPage /></RouteGuard>} />
                  <Route path="/admin/developments/:developmentId" element={<RouteGuard requireRole="admin"><AdminDevelopmentReviewPage /></RouteGuard>} />
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
                <Route
                  path="/submit-client-need"
                  element={<Navigate to={BUYER_NEED_COMPOSE_ROUTE} replace />}
                />
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
              </React.Suspense>
              </SharedListingGate>
              <React.Suspense fallback={null}>
                <CookieConsent />
              </React.Suspense>
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

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AgentDashboard from "./pages/AgentDashboard";
import BuyerAuth from "./pages/BuyerAuth";
// import removed: AgentSearch (redirect to OurAgents)
import SubmitClientNeed from "./pages/SubmitClientNeed";
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
          <Route path="/buyer-auth" element={<BuyerAuth />} />
          <Route path="/browse" element={<BrowseProperties />} />
          <Route path="/search-results" element={<SearchResults />} />
          <Route path="/our-agents" element={<OurAgents />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/hot-sheets" element={<HotSheets />} />
          <Route path="/hot-sheets/:id/review" element={<HotSheetReview />} />
          <Route path="/my-clients" element={<MyClients />} />
          <Route path="/client-hot-sheet/:token" element={<ClientHotSheet />} />
          <Route path="/agent-search" element={<OurAgents />} />
          <Route path="/agent-dashboard" element={<AgentDashboard />} />
          <Route path="/submit-client-need" element={<SubmitClientNeed />} />
          <Route path="/add-listing" element={<AddListing />} />
          <Route path="/add-rental-listing" element={<AddRentalListing />} />
          <Route path="/edit-listing/:id" element={<EditListing />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/consumer-property/:id" element={<ConsumerPropertyDetail />} />
          <Route path="/agent/:id" element={<AgentProfile />} />
          <Route path="/agent-profile-editor" element={<AgentProfileEditor />} />
          <Route path="/manage-team" element={<ManageTeam />} />
          <Route path="/team/:id" element={<TeamProfile />} />
          <Route path="/manage-coverage-areas" element={<ManageCoverageAreas />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  Phone, 
  ListPlus, 
  Edit, 
  Trash2, 
  FileText,
  Calendar,
  Clock
} from "lucide-react";
import { HotSheetStatusBadge } from "@/components/ui/status-badge";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import ContactQuickActions from "@/components/ContactQuickActions";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_type: string | null;
  is_favorite?: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Subset for ContactQuickActions compatibility
type QuickActionsClient = Pick<Client, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'client_type' | 'is_favorite'>;

interface HotSheetAssignment {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface ContactDetailDrawerProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateHotSheet: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onViewFavorites: (client: Client) => void;
}

// Helper function for title case display
const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const ContactDetailDrawer = ({ 
  client, 
  open, 
  onOpenChange,
  onCreateHotSheet,
  onEdit,
  onDelete,
  onViewFavorites
}: ContactDetailDrawerProps) => {
  const navigate = useNavigate();
  const [assignedHotSheets, setAssignedHotSheets] = useState<HotSheetAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client && open) {
      fetchAssignedHotSheets();
    }
  }, [client, open]);

  const fetchAssignedHotSheets = async () => {
    if (!client) return;
    setLoading(true);
    
    try {
      // Use hot_sheet_clients as canonical source (per user instructions)
      const { data: junctionData, error: junctionError } = await supabase
        .from('hot_sheet_clients' as any)
        .select(`
          hot_sheet_id,
          hot_sheets (
            id,
            name,
            is_active,
            created_at
          )
        `)
        .eq('client_id', client.id);
      
      if (junctionError) throw junctionError;
      
      // Extract hot sheets from junction, avoiding duplicates
      const hotSheetsFromJunction = (junctionData || [])
        .map((item: any) => {
          const hs = item.hot_sheets;
          if (Array.isArray(hs)) return hs[0];
          return hs;
        })
        .filter((hs: any): hs is HotSheetAssignment => hs !== null);
      
      // Also check legacy hot_sheets.client_id for any not in junction
      const { data: legacyData, error: legacyError } = await supabase
        .from('hot_sheets')
        .select('id, name, is_active, created_at')
        .eq('client_id', client.id);
      
      if (legacyError) throw legacyError;
      
      // Merge without duplicates (junction takes precedence)
      const junctionIds = new Set(hotSheetsFromJunction.map(hs => hs.id));
      const legacySheets = (legacyData || []).filter(hs => !junctionIds.has(hs.id));
      
      const allHotSheets = [...hotSheetsFromJunction, ...legacySheets];
      setAssignedHotSheets(allHotSheets);
    } catch (error) {
      console.error("Error fetching assigned hot sheets:", error);
      setAssignedHotSheets([]);
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  const contactName = `${toTitleCase(client.first_name)} ${toTitleCase(client.last_name)}`;
  const initials = `${client.first_name?.[0]?.toUpperCase() || ''}${client.last_name?.[0]?.toUpperCase() || ''}`;

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[420px] overflow-y-auto bg-white">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-base font-semibold bg-zinc-100 text-zinc-700">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">{contactName}</SheetTitle>
              {client.client_type && (
                <Badge variant="secondary" className="mt-1 capitalize text-xs">
                  {client.client_type}
                </Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <ContactQuickActions
              client={client}
              size="md"
              onHotSheet={() => {
                onCreateHotSheet(client);
                onOpenChange(false);
              }}
              onViewFavorites={() => {
                onViewFavorites(client);
                onOpenChange(false);
              }}
            />
            <Button 
              variant="outline"
              onClick={(e) => handleActionClick(e, () => onEdit(client))}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button 
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={(e) => handleActionClick(e, () => onDelete(client.id))}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-900">Contact Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 text-zinc-600">
                <Mail className="h-4 w-4 text-zinc-400" />
                <a href={`mailto:${client.email}`} className="hover:text-zinc-900 truncate">
                  {client.email}
                </a>
              </div>
              {client.phone && (
                <div className="flex items-center gap-3 text-zinc-600">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <a href={`tel:${client.phone}`} className="hover:text-zinc-900">
                    {formatPhoneNumber(client.phone)}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-zinc-600 text-xs">
                <Calendar className="h-4 w-4 text-zinc-400" />
                Added {new Date(client.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {client.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-400" />
                  Notes
                </h4>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{client.notes}</p>
              </div>
            </>
          )}

          {/* Assigned Hot Sheets */}
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <ListPlus className="h-4 w-4 text-zinc-400" />
              Assigned Hot Sheets
              {assignedHotSheets.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {assignedHotSheets.length}
                </Badge>
              )}
            </h4>
            
            {loading ? (
              <p className="text-sm text-zinc-400 py-2">Loading...</p>
            ) : assignedHotSheets.length > 0 ? (
              <div className="space-y-2">
                {assignedHotSheets.map((hotSheet) => (
                  <div
                    key={hotSheet.id}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors"
                    onClick={() => {
                      navigate(`/hot-sheet/${hotSheet.id}/review`);
                      onOpenChange(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {hotSheet.name}
                      </p>
                      <p className="text-xs text-zinc-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(hotSheet.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <HotSheetStatusBadge 
                      status={hotSheet.is_active ? "active" : "paused"} 
                      size="sm" 
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 py-2">
                No hot sheets assigned yet
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ContactDetailDrawer;

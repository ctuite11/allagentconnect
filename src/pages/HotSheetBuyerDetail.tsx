import { useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";

const HotSheetBuyerDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();

  return (
    <PageShell>
      <h1 className="text-2xl font-bold mb-4">Hot Sheet Buyer Detail</h1>
      <p className="text-muted-foreground">Client ID: {clientId}</p>
      <p className="text-muted-foreground mt-2">Full implementation coming soon.</p>
    </PageShell>
  );
};

export default HotSheetBuyerDetail;

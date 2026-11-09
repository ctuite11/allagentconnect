import { isDcmlsHost } from "@/lib/host";
import DcmlsFooter from "@/components/dcmls/DcmlsFooter";
import FooterV2 from "@/components/home-v2/FooterV2";

/**
 * One AAC public footer for every public/marketing/legal page.
 * The separate DCMLS consumer brand keeps its own existing footer.
 */
export default function Footer() {
  return isDcmlsHost() ? <DcmlsFooter /> : <FooterV2 />;
}

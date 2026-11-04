import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { BrandColorStyle } from "@/components/marketing/BrandColorStyle";
import { NewsTicker } from "@/components/marketing/NewsTicker";
import { MKT } from "@/lib/marketingTheme";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: MKT.bg, color: MKT.ink }}>
      <BrandColorStyle />
      <NewsTicker />
      <PublicNav />
      <main style={{ flex: 1 }}>{children}</main>
      <PublicFooter />
    </div>
  );
}

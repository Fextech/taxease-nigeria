import Link from "next/link";
import Image from "next/image";
import BackgroundLayer from "@/components/BackgroundLayer";
import MarketingFooter from "@/components/MarketingFooter";
import TrustedHtmlFrame from "@/components/TrustedHtmlFrame";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Maintenance | Banklens Nigeria",
  description: "Banklens Nigeria is currently under maintenance.",
};

async function getMaintenanceHtml(): Promise<string> {
  try {
    const htmlRow = await prisma.appConfig.findUnique({
      where: { key: "maintenance_mode_html" },
      select: { value: true },
    });

    return htmlRow?.value || '';
  } catch {
    return '<h2 style="text-align:center;color:#94a3b8;margin-top:60px;">We are currently undergoing maintenance. Please check back later.</h2>';
  }
}

export default async function MaintenancePage() {
  const html = await getMaintenanceHtml();

  return (
    <div className="min-h-screen relative font-sans text-slate-300 flex flex-col overflow-x-hidden">
      <BackgroundLayer />
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-[#131F20] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/Banklense-logo.svg" alt="Banklens Nigeria" width={200} height={80} className="h-12 sm:h-14 w-auto" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium hover:text-white transition-colors text-slate-400">
              Sign In
            </Link>
            <Link href="/" className="text-sm font-medium hover:text-white transition-colors text-slate-400">
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Body — dynamic HTML from admin */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 flex flex-col items-center justify-center relative z-10">
        <TrustedHtmlFrame
          html={html}
          title="Maintenance page content"
          className="w-full"
        />
      </main>

      <MarketingFooter />
    </div>
  );
}

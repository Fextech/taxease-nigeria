import Link from "next/link";
import Image from "next/image";

export default function MarketingFooter() {
  return (
    <footer className="bg-[#131F20] border-t border-white/5 py-10 px-6 mt-auto relative z-10 w-full">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-3">
            <Image src="/Banklense-logo.svg" alt="Banklens Nigeria" width={180} height={72} className="h-10 sm:h-12 w-auto opacity-80 hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-[13px] text-slate-500 mt-2">
            © {new Date().getFullYear()} Banklens Technology. All rights reserved.
          </p>
        </div>
        <div className="flex gap-6">
          <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
          <a href="mailto:support@flowiselabs.com" className="text-sm text-slate-400 hover:text-white transition-colors">Contact Support</a>
        </div>
      </div>
    </footer>
  );
}

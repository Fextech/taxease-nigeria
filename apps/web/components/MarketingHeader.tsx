import Link from "next/link";
import Image from "next/image";
import SignUpLink from "@/components/SignUpLink";

export default function MarketingHeader() {
  return (
    <nav className="sticky top-0 z-50 bg-[#131F20] border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <Image src="/Banklense-logo.svg" alt="Banklens Nigeria" width={200} height={80} className="h-12 sm:h-14 w-auto" priority />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-slate-400 text-sm font-semibold hover:text-white transition-colors">
            Log In
          </Link>
          <SignUpLink className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#e09228] transition-all hover:-translate-y-[1px]">
            Get Started
          </SignUpLink>
        </div>
      </div>
    </nav>
  );
}

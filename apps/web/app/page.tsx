import Link from "next/link";
import Image from "next/image";
import BackgroundLayer from "@/components/BackgroundLayer";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SignUpLink from "@/components/SignUpLink";

export default function Home() {
  return (
    <div className="min-h-screen relative text-[#f1f5f7] font-sans overflow-x-hidden flex flex-col">
      <BackgroundLayer />
      <MarketingHeader />

      <main>
        {/* Hero Section */}
        <section className="relative max-w-6xl mx-auto px-6 pt-[100px] pb-20 text-center flex flex-col items-center">
          <div className="w-full relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 bg-[#f0a030]/10 border border-[#f0a030]/20 text-white px-4 py-1.5 rounded-full text-[13px] font-semibold mb-6">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              The smartest way to compute PITA in Nigeria
            </div>
            <h1 className="text-[clamp(40px,6vw,64px)] font-extrabold leading-[1.1] text-white max-w-[800px] mb-6 tracking-tight">
              Simplify Your <span className="text-accent relative inline-block">Tax Returns</span> with AI-Powered Intelligence
            </h1>
            <p className="text-[clamp(16px,2vw,20px)] leading-relaxed text-slate-400 max-w-[600px] mb-10">
              Upload your bank statements in PDF. Our advanced AI categorizes your transactions, and help you annotate your exact personal income tax liability, and generates verifiable reports for the FCT-IRS or LIRS in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full sm:w-auto">
              <SignUpLink className="flex items-center justify-center w-full sm:w-auto gap-2 bg-primary text-white px-8 py-4 rounded-xl text-base font-semibold transition-all hover:bg-[#e09228] hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(240,160,48,0.4)] hover:shadow-[0_6px_20px_rgba(240,160,48,0.5)]">
                Start for Free
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </SignUpLink>
              <a href="#features" className="flex justify-center w-full sm:w-auto bg-white/5 text-white border border-white/10 px-8 py-4 rounded-xl text-base font-semibold hover:bg-white/10 hover:border-white/20 transition-all">
                See How It Works
              </a>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 pt-10 border-t border-white/5 w-full sm:w-auto items-center sm:items-start text-center sm:text-left">
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">99%</span>
                <span className="text-[13px] text-slate-400 uppercase tracking-wider font-semibold">Extraction Accuracy</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">20+</span>
                <span className="text-[13px] text-slate-400 uppercase tracking-wider font-semibold">Banks Supported</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-white">10x</span>
                <span className="text-[13px] text-slate-400 uppercase tracking-wider font-semibold">Faster Filing</span>
              </div>
            </div>
          </div>

          {/* Abstract background shapes */}
          <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] bg-[#23494d]/40 rounded-full blur-[100px] -z-10 opacity-50"></div>
          <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] bg-[#f0a030]/15 rounded-full blur-[100px] -z-10 opacity-50"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-primary/90 border-t border-white/5 py-[100px] px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-[clamp(28px,4vw,40px)] font-bold text-white mb-4 tracking-tight">Everything you need for seamless tax compliance</h2>
              <p className="text-lg text-slate-300/80 max-w-[600px] mx-auto leading-relaxed">
                Built specifically for the Nigerian Personal Income Tax Act (PITA), taking the guesswork out of your annual self-assessments.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/10 hover:-translate-y-1 hover:border-white/10 transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-2xl bg-[#f0a030]/10 text-primary">
                  <span className="material-symbols-outlined">auto_awesome</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">AI Statement Parsing</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Simply drag and drop your bank statements. Our AI engine accurately extracts every transaction from PDFs without manual data entry.
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/10 hover:-translate-y-1 hover:border-white/10 transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-2xl bg-emerald-500/10 text-emerald-500">
                  <span className="material-symbols-outlined">calculate</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Automated PITA Computation</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  We automatically apply the exact graduated tax bands, Consolidated Relief Allowance (CRA), and exemptions based on Nigerian tax law.
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/10 hover:-translate-y-1 hover:border-white/10 transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-2xl bg-blue-500/10 text-blue-500">
                  <span className="material-symbols-outlined">category</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Smart Categorization</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Quickly annotate transactions as Taxable Income, Business Expenses, or Non-Taxable transfers. Learn from your historical choices.
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 hover:bg-white/10 hover:-translate-y-1 hover:border-white/10 transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-2xl bg-violet-500/10 text-violet-500">
                  <span className="material-symbols-outlined">description</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Ready-to-File Reports</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Generate comprehensive, professional reports with full breakdowns of your computations, ready to be submitted to your State IRS.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-[100px] px-6">
          <div className="max-w-3xl mx-auto text-center bg-[#23494d]/40 border border-[#23494d] py-16 px-8 rounded-[32px] relative overflow-hidden backdrop-blur-sm">
            <h2 className="text-[clamp(32px,4vw,48px)] font-extrabold text-white mb-4 tracking-tight">Stop struggling with spreadsheets.</h2>
            <p className="text-lg text-slate-300 max-w-[500px] mx-auto mb-8">
              Join the growing number of freelancers, consultants, and business owners in Nigeria taking control of their taxes.
            </p>
            <SignUpLink className="inline-flex justify-center bg-primary text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-[#e09228] transition-all shadow-[0_4px_14px_rgba(240,160,48,0.4)]">
              Create your free account
            </SignUpLink>
          </div>
        </section>
      </main>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
}

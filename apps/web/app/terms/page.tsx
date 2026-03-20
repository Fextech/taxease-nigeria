import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Terms of Service | Banklens Nigeria",
  description: "Terms of Service for Banklens Nigeria",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--te-primary-dark)] text-slate-300 font-sans">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-[#162e31]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/Banklense-logo.svg" alt="Banklens Nigeria" width={140} height={56} className="h-8 w-auto" priority />
          </Link>
          <Link href="/" className="text-sm font-medium hover:text-white transition-colors text-slate-400">
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-8">Terms of Service</h1>

        <div className="space-y-8 prose prose-invert prose-slate max-w-none">
          <section>
            <p className="text-sm text-slate-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            <p className="leading-relaxed">
              These Terms of Service ("Terms") govern your use of the Banklens Nigeria website and the services,
              features, content, or applications offered by Banklens Technology ("we," "us," or "our").
              By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Use of Services</h2>
            <p className="leading-relaxed mb-4">
              Banklens Nigeria provides a platform to simplify personal income tax (PITA) compliance for Nigerian taxpayers.
              You agree to use our services only for lawful purposes and in accordance with these Terms. You must:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your password and accept all risks of unauthorized access to your account.</li>
              <li>Ensure that the bank statements you upload belong to you or that you have the explicit legal authority to process them.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Tax Computation Accuracy</h2>
            <p className="leading-relaxed">
              While we utilize advanced AI models to parse transactions and categorize data based on the Nigerian Personal Income Tax Act (PITA),
              the generated tax reports are computational estimates intended to assist with tax filings. Banklens Technology is not a certified tax
              advisory firm. You are ultimately responsible for reviewing your categorized transactions, consulting with a qualified tax
              professional, and ensuring the accuracy of the final returns submitted to the FCT-IRS, LIRS, or other relevant tax authorities in Nigeria.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Data Usage and Privacy</h2>
            <p className="leading-relaxed mb-4">
              By using our service, you grant us permission to securely process the financial documents you upload.
              We handle your data strictly in accordance with our Privacy Policy.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li>We do not share your raw bank statements with third-party advertisers.</li>
              <li>Transaction data is processed securely through partner APIs (such as Google Gemini) solely for the purpose of extraction and categorization.</li>
              <li>You may request the deletion of your account and associated statement data at any time via your account settings.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Limitations of Liability</h2>
            <p className="leading-relaxed">
              To the maximum extent permitted by applicable law, Banklens Technology shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill,
              arising from (i) your access to or use of or inability to access or use the services; (ii) any conduct or content of any
              third party on the services; (iii) any errors in the processing or computation of your tax liabilities resulting from
              incorrectly parsed data or inaccurate user annotations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Pricing, Billing, and Credits</h2>
            <p className="leading-relaxed mb-4">
              Banklens Nigeria reserves the right to modify its subscription fees, pricing tiers, and credit costs at any time. Pricing adjustments may occur due to changes in third-party processing fees, inflation, or the costs of our underlying technology infrastructure (including AI processing fees). We will make reasonable efforts to notify users of significant pricing changes.
            </p>
            <p className="leading-relaxed mb-4">
              <strong>Credit-Based Access:</strong> If you choose to unlock your workspace on a month-by-month basis using our credit system, you acknowledge that the price per credit is subject to change at any point during the tax year. We do not guarantee that the cost of credits will remain constant. As a result, the price of a credit may increase mid-year before you have finished unlocking all your desired months.
            </p>
            <p className="leading-relaxed">
              <strong>Full Annual Access:</strong> To protect against potential price increases throughout the year, we strongly encourage users to opt for the "Unlock Full Year" (annual access) subscription options. Purchasing full access pays for the entire year upfront and locks in your rate for the current tax year, protecting you from any subsequent mid-year price adjustments to our credit system or general pricing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Modifications to Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to modify these Terms at any time. If we make material changes, we will notify you by email or through a notice on our platform.
              Your continued use of the services after any changes indicates your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about these Terms, please contact our support team at:
            </p>
            <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10 inline-block">
              <span className="text-white font-medium">Email: </span>
              <a href="mailto:support@flowiselabs.com" className="text-primary hover:text-[#e09228] transition-colors font-medium">
                support@flowiselabs.com
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 mt-12 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} Banklens Technology. All rights reserved.</p>
      </footer>
    </div>
  );
}

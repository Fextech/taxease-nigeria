import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Privacy Policy | Banklens Nigeria",
  description: "Privacy Policy for Banklens Nigeria",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        
        <div className="space-y-8 prose prose-invert prose-slate max-w-none">
          <section>
            <p className="text-sm text-slate-400 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            <p className="leading-relaxed">
              At Banklens Nigeria, we take your privacy seriously. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you visit our website and use our tax preparation
              and compliance services. Please read this privacy policy carefully. If you do not agree with the
              terms of this privacy policy, please do not access the site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Collection of your Information</h2>
            <p className="leading-relaxed mb-4">
              We may collect information about you in a variety of ways. The information we may collect via the Site includes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and Tax Identification Number (TIN), that you voluntarily give to us when you register with the Site.</li>
              <li><strong>Financial Data:</strong> Bank statements and transaction data that you upload for the purpose of tax computation. We process this data securely and do not sell or share it with third-party marketers.</li>
              <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Site, such as your IP address, browser type, and operating system.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Use of your Information</h2>
            <p className="leading-relaxed mb-4">
              Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300">
              <li>Create and manage your account.</li>
              <li>Process your bank statements and compute your tax liabilities.</li>
              <li>Generate compliance reports for the FCT-IRS, LIRS, or other relevant tax authorities.</li>
              <li>Email you regarding your account or order.</li>
              <li>Improve our AI classification models (transaction data is anonymized before any such use).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Disclosure of your Information</h2>
            <p className="leading-relaxed">
              We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information regarding visitors and users with our business partners, trusted affiliates, and advertisers for the purposes outlined above. We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Data Security</h2>
            <p className="leading-relaxed">
              We use administrative, technical, and physical security measures to help protect your personal information. Your uploaded bank statements and generated reports are stored securely using industry-standard encryption. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Contact Us</h2>
            <p className="leading-relaxed">
              If you have questions or comments about this Privacy Policy, please contact us at:
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

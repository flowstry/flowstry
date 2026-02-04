import Footer from '../components/Footer';
import StickyHeader from '../components/StickyHeader';

const primaryCta = process.env.NEXT_PUBLIC_APP_URL || "/";

export default function PrivacyPolicy() {
  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#2b2b2b,transparent_55%)]" />
      <div className="absolute inset-0 -z-10 dot-grid opacity-60" />
      
      <StickyHeader appUrl={primaryCta} />

      <div className="min-h-screen text-gray-300 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
            <p className="text-lg text-gray-400">Effective Date: 2026-02-04</p>
          </div>

          <div className="space-y-6">
            <p>
              <strong>Flowstry</strong> ("we," "us," or "our") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you access our application.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
              
              <div className="space-y-4">
                <h3 className="text-xl font-medium text-white">A. Personal Data</h3>
                <p>
                  We collect personally identifiable information that you voluntarily provide to us when you register for an account or choose to participate in various activities related to the Application. Data we collect includes:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Identity Data:</strong> Name, Google ID (if using Google Auth).</li>
                  <li><strong>Contact Data:</strong> Email address.</li>
                  <li><strong>Profile Data:</strong> Avatar URL, user preferences (e.g., theme).</li>
                </ul>

                <h3 className="text-xl font-medium text-white mt-6">B. Usage Data</h3>
                <p>
                  We automatically collect certain information when you visit, use, or navigate the Application. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, and information about how and when you use our Application.
                </p>

                <h3 className="text-xl font-medium text-white mt-6">C. Workspace & Diagram Content</h3>
                <p>We store the content you create, such as workspaces and diagrams.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Unencrypted Content:</strong> By default, content is stored securely on our servers. We do not access this content except as necessary to provide the service (e.g., storage, backup).</li>
                  <li><strong>Encrypted Content:</strong> If you utilize our "End-to-End Encryption" feature, your workspace and diagram content is encrypted on your device <em>before</em> it is sent to our servers. We do not possess the decryption keys and <strong>cannot</strong> access or view this content.</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Use of Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Create and manage your account.</li>
                <li>Facilitate the creation and editing of diagrams.</li>
                <li>Send you administrative information, suchs as updates, security alerts, and support messages.</li>
                <li>Respond to your comments and questions.</li>
                <li>Maintain the safety and security of our Application.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. GDPR Compliance (General Data Protection Regulation)</h2>
              <p className="mb-4">
                If you are a resident of the European Economic Area (EEA), you have certain data protection rights from the GDPR. Flowstry aims to take reasonable steps to allow you to correct, amend, delete, or limit the use of your Personal Data.
              </p>
              <p className="font-semibold mb-2">Your Rights:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>The right to access:</strong> You have the right to request copies of your personal data.</li>
                <li><strong>The right to rectification:</strong> You have the right to request that we correct any information you believe is inaccurate.</li>
                <li><strong>The right to erasure:</strong> You have the right to request that we erase your personal data, under certain conditions.</li>
                <li><strong>The right to restrict processing:</strong> You have the right to request that we restrict the processing of your personal data.</li>
                <li><strong>The right to object to processing:</strong> You have the right to object to our processing of your personal data.</li>
                <li><strong>The right to data portability:</strong> You have the right to request that we transfer the data that we have collected to another organization, or directly to you.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Encryption & Data Security</h2>
              <p>We implement appropriate technical and organizational security measures designed to protect the security of any personal information we process.</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Zero-Knowledge Encryption:</strong> For workspaces where encryption is enabled, we utilize client-side encryption. The decryption key is derived from a password known only to you. <strong>We do not store this password.</strong> If you lose this password, we cannot recover your data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Third-Party Service Providers</h2>
              <p>
                We may share information with third parties that perform services for us or on our behalf, including data hosting (Google Cloud Platform) and authentication (Google Auth).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Us</h2>
              <p className="mb-2">
                If you have questions or comments about this policy, or to exercise your GDPR rights, please contact us at:
              </p>
              <a href="mailto:info@flowstry.com" className="text-blue-400 hover:text-blue-300 transition-colors">info@flowstry.com</a>
            </section>
          </div>
        </div>
      </div>
      
      <Footer />
    </main>
  );
}

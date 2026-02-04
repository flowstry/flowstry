import Footer from '../components/Footer';
import StickyHeader from '../components/StickyHeader';

const primaryCta = process.env.NEXT_PUBLIC_APP_URL || "/";

export default function TermsAndConditions() {
  return (
    <main className="relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#2b2b2b,transparent_55%)]" />
      <div className="absolute inset-0 -z-10 dot-grid opacity-60" />

      <StickyHeader appUrl={primaryCta} />

      <div className="min-h-screen text-gray-300 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">Terms and Conditions</h1>
            <p className="text-lg text-gray-400">Effective Date: 2026-02-04</p>
          </div>

          <div className="space-y-8">
            <p>
              Welcome to <strong>Flowstry</strong>! "Flowstry" refers to the open-source project and its maintainers. These Terms and Conditions ("Terms") govern your use of the Flowstry application and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms.
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Accounts</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Registration:</strong> You must register for an account to access certain features. You agree to provide accurate, current, and complete information during the registration process.</li>
                <li><strong>Security:</strong> You are responsible for safeguarding your account credentials. You agree not to disclose your password (including any Workspace Encryption Passwords) to any third party. You are responsible for any activity using your account.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. User Content & License</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Ownership:</strong> You retain all rights and ownership of the diagrams, workspaces, and other content you create ("User Content").</li>
                <li><strong>License:</strong> You grant Flowstry a worldwide, non-exclusive, royalty-free license to use, host, store, reproduce, modify, and create derivative works (such as thumbnails) of your User Content <em>solely for the purpose of operating, promoting, and improving the Service</em>. This license does not transfer ownership of your User Content and does not grant Flowstry rights beyond operating the Service.</li>
                <li><strong>Encrypted Content:</strong> For content secured with our End-to-End Encryption feature, you acknowledge that Flowstry cannot access the content to provide features that require content analysis.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Encryption & Data Loss</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>User Responsibility:</strong> If you enable End-to-End Encryption on a workspace, you are solely responsible for managing and safeguarding the encryption password/keys.</li>
                <li><strong>No Recovery:</strong> Flowstry <strong>does not</strong> store your encryption password. If you lose or forget the password for an encrypted workspace, the data therein will be permanently inaccessible. Flowstry <strong>cannot</strong> recover this data for you.</li>
                <li><strong>Liability:</strong> We are not liable for any loss of data resulting from lost passwords, corrupted keys, or your failure to secure your encryption credentials.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Open Source vs. Hosted Service</h2>
              <p>
                These Terms apply specifically to the hosted Service provided at [Your URL]. The underlying software for Flowstry may be available under an open-source license; however, your use of this hosted Service is subject to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Acceptable Use</h2>
              <p className="mb-2">You agree not to use the Service to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Violate any laws or regulations.</li>
                <li>Infringe on the rights of others (privacy, publicity, intellectual property).</li>
                <li>Distribute malware or other harmful code.</li>
                <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Termination & Service Changes</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Termination:</strong> We may suspend or restrict access to the Service if you violate these Terms or misuse the Service.</li>
                <li><strong>Service Changes:</strong> We currently provide the Service free of charge. We reserve the right to introduce fees or usage limits for the Service in the future, provided we give you reasonable notice before any such changes take effect.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Limitation of Liability & No Warranty</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Disclaimer:</strong> Flowstry is provided as an open-source project and is offered on an “as is” and “as available” basis. The maintainers make no warranties, express or implied, regarding the reliability, availability, security, or suitability of the Service for any purpose.</li>
                <li><strong>Limitation:</strong> To the maximum extent permitted by applicable law, in no event shall Flowstry be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages arising out of or relating to the use of, or inability to use, this Service.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Governing Law</h2>
              <p>
                These Terms shall be governed and construed in accordance with the laws of the maintainer's country of residence, without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Contact Us</h2>
              <p className="mb-2">
                If you have any questions about these Terms, please contact us at:
              </p>
              <a href="mailto:support@flowstry.com" className="text-blue-400 hover:text-blue-300 transition-colors">support@flowstry.com</a>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

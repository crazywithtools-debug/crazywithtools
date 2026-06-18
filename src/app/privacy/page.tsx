export const metadata = {
  title: "Privacy Policy - Crazy With Tools",
  description:
    "Privacy policy for Crazy With Tools. Learn how we handle your data and protect your privacy.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen p-8 bg-[#09090b] text-white">
      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last Updated: June 2026</strong>
        </p>
        <p>
          Crazy With Tools ("Platform", "we", "us", or "our") operates the
          website and application at https://crazywithtools.com. This Privacy
          Policy explains how we collect, use, disclose, and safeguard your
          information when you visit and use our Platform.
        </p>

        <h2>1. Information We Collect</h2>
        <h3>Local Browser Storage</h3>
        <p>
          The Platform stores the following data locally in your browser's{" "}
          <strong>localStorage</strong> for your convenience:
        </p>
        <ul>
          <li>Generated content drafts and excerpts</li>
          <li>Preferences and user settings</li>
          <li>Editor state and session history</li>
          <li>Optional saved API keys (if you choose to save them)</li>
        </ul>
        <p>
          <strong>Important:</strong> Do not save API keys or sensitive
          credentials in the Platform unless you understand the risks of local
          storage. Local data is accessible by any script on the same domain.
        </p>

        <h3>Server and Log Data</h3>
        <p>
          When you use our API routes or make requests to our servers, we may
          collect:
        </p>
        <ul>
          <li>IP address and browser user-agent</li>
          <li>Request timing and performance metrics</li>
          <li>Error logs and server diagnostics</li>
        </ul>

        <h2>2. Third-Party Services &amp; Data Processing</h2>
        <p>Our Platform uses the following third-party services:</p>
        <ul>
          <li>
            <strong>Google Gemini API:</strong> For AI content generation. Data
            sent to this service is subject to Google's Privacy Policy. Do not
            send sensitive personal information.
          </li>
          <li>
            <strong>In-memory history:</strong> The app stores session history
            in-memory by default. You may configure persistent storage
            separately if desired.
          </li>
        </ul>
        <p>
          Review each service's privacy policy before using features that
          interact with them.
        </p>

        <h2>3. How We Use Your Data</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide, maintain, and improve the Platform</li>
          <li>Deliver AI-generated content in response to your requests</li>
          <li>Provide and improve the Platform features</li>
          <li>Diagnose technical issues and maintain security</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>4. Cookies &amp; Tracking Technologies</h2>
        <p>
          We use cookies and similar technologies to enhance your experience.
          Cookies are used for preferences and basic functionality. You can
          manage cookie preferences in your browser settings.
        </p>
        <p>
          We do not sell or share personal data with third parties outside of
          the services listed above.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          Local storage data persists until you manually clear it or clear your
          browser cache. Server logs and backend data (if used) are retained for
          30 days unless otherwise required by law.
        </p>

        <h2>6. Your Privacy Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            Access, modify, or delete your locally stored data at any time
          </li>
          <li>
            Request that we delete server-side data associated with your account
          </li>
          <li>Access, modify, or delete locally stored data at any time</li>
          <li>Refuse cookies (via browser settings)</li>
        </ul>

        <h2>7. Security</h2>
        <p>
          We employ industry-standard security practices to protect your
          information. However, no method of transmission over the internet is
          100% secure. We cannot guarantee absolute security.
        </p>

        <h2>8. Children's Privacy</h2>
        <p>
          This Platform is not intended for children under 13. We do not
          knowingly collect personal information from children. If we learn we
          have collected data from a child under 13, we will promptly delete it.
        </p>

        <h2>9. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy periodically. We will notify you of
          significant changes by posting the updated policy and updating the
          "Last Updated" date above. Your continued use of the Platform
          constitutes acceptance of any changes.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our data practices,
          please contact us:
        </p>
        <ul>
          <li>
            <strong>Email:</strong> privacy@crazywithtools.com
          </li>
          <li>
            <strong>Address:</strong> Available upon request
          </li>
          <li>
            <strong>GitHub Issues:</strong> Report concerns at our project
            repository
          </li>
        </ul>

        <h2>11. California Consumers (CCPA)</h2>
        <p>
          California residents have additional rights under the California
          Consumer Privacy Act (CCPA). For requests to know, delete, or opt-out
          of the "sale" of your personal information, please contact us using
          the information above.
        </p>

        <h2>12. European Users (GDPR)</h2>
        <p>
          If you are located in the European Union, United Kingdom, or other
          GDPR-jurisdictions, you have rights including the right to access,
          correct, delete, or port your data. Contact us to exercise these
          rights.
        </p>
      </div>
    </main>
  );
}

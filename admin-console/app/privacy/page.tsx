export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'Georgia, serif', color: '#222' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: April 13, 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>1. Introduction</h2>
      <p>
        St. Thomas Malankara Orthodox Church, Long Island ("we", "our", or "us") operates the StThomasLI mobile
        application. This policy explains how we collect, use, and protect your personal information.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>2. Information We Collect</h2>
      <p>We collect the following information from members of our parish directory:</p>
      <ul>
        <li>Name, email address, and phone number</li>
        <li>Family membership information</li>
        <li>Profile photos (optional)</li>
        <li>App usage data for improving the experience</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>3. How We Use Your Information</h2>
      <p>Your information is used solely to:</p>
      <ul>
        <li>Display your family in the parish directory</li>
        <li>Allow other parish members to contact you</li>
        <li>Send parish communications and calendar updates</li>
        <li>Administer your parish membership account</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>4. Information Sharing</h2>
      <p>
        We do not sell, trade, or share your personal information with third parties. Directory information
        is visible only to verified members of St. Thomas Malankara Orthodox Church, Long Island parish.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>5. Data Security</h2>
      <p>
        Your data is stored securely using Supabase, which employs industry-standard encryption and
        security practices. Access is restricted to authorized parish administrators.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>6. Your Rights</h2>
      <p>You may request to:</p>
      <ul>
        <li>Access the personal information we hold about you</li>
        <li>Correct any inaccurate information</li>
        <li>Delete your account and associated data</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>7. Contact Us</h2>
      <p>
        If you have questions about this privacy policy or your data, please contact the parish office at{' '}
        <a href="mailto:webmaster@stthomasli.org" style={{ color: '#1A4FC4' }}>
          webmaster@stthomasli.org
        </a>
      </p>
    </div>
  );
}

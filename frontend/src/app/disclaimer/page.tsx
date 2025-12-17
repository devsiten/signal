import Link from 'next/link';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-text-primary mb-4">
            Disclaimer
          </h1>
          <p className="text-text-secondary">
            Please read this carefully before using our service.
          </p>
        </div>

        {/* Content */}
        <div className="card p-8 md:p-10 prose-content">
          <section className="mb-10">
            <h2>Not Financial Advice</h2>
            <p>
              The content provided on Hussayn Signal, including but not limited to trading signals,
              market analysis, and educational content, is for informational purposes only and
              should not be construed as financial, investment, or trading advice.
            </p>
            <p>
              We are not registered investment advisors, brokers, or dealers. All trading involves
              risk, and you should never trade with money you cannot afford to lose.
            </p>
          </section>

          <section className="mb-10">
            <h2>No Guarantees</h2>
            <p>
              Past performance is not indicative of future results. While we share our trading
              activities and results transparently, we make no guarantees or promises about future
              performance. The cryptocurrency market is highly volatile and unpredictable.
            </p>
            <p>
              Any win screenshots or performance data shared are historical records of specific
              trades and should not be interpreted as typical results or promises of similar
              outcomes.
            </p>
          </section>

          <section className="mb-10">
            <h2>Your Responsibility</h2>
            <p>
              You are solely responsible for your own trading decisions. Before making any
              investment decision, you should:
            </p>
            <ul>
              <li>Conduct your own research and due diligence</li>
              <li>Consider your personal financial situation and risk tolerance</li>
              <li>Consult with qualified financial professionals if needed</li>
              <li>Never invest more than you can afford to lose</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2>Risk Disclosure</h2>
            <p>
              Trading cryptocurrencies involves significant risk of loss. Prices can be extremely
              volatile, and you may lose some or all of your investment. Leverage trading
              amplifies both potential profits and losses.
            </p>
            <p>
              Specific risks include but are not limited to: market volatility, liquidity risks,
              technical failures, regulatory changes, exchange hacks, and smart contract
              vulnerabilities.
            </p>
          </section>

          <section className="mb-10">
            <h2>No Liability</h2>
            <p>
              Hussayn Signal and its operators shall not be held liable for any losses, damages,
              or claims arising from:
            </p>
            <ul>
              <li>Trading decisions made based on our content</li>
              <li>Technical issues or service interruptions</li>
              <li>Information that may be inaccurate or outdated</li>
              <li>Your reliance on any content provided</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2>Subscription Terms</h2>
            <p>
              All subscription payments are final and non-refundable. By subscribing, you
              acknowledge that:
            </p>
            <ul>
              <li>Payments are made directly on the Solana blockchain</li>
              <li>Subscription grants access for 30 days from payment or renewal</li>
              <li>Early renewal extends your existing subscription</li>
              <li>Subscriptions may be paused at any time at our discretion</li>
              <li>No refunds are provided for any reason</li>
            </ul>
          </section>

          <section>
            <h2>Changes to This Disclaimer</h2>
            <p>
              We reserve the right to modify this disclaimer at any time. Continued use of our
              service after changes constitutes acceptance of the modified terms.
            </p>
            <p className="text-text-muted text-sm mt-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div className="mt-10 text-center">
          <Link href="/" className="text-accent-gold hover:text-accent-goldLight transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

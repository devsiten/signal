'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/hooks/useWallet';
import { useAppStore } from '@/stores/app';
import { getPosts, getSettings } from '@/lib/api';
import { PostCard } from '@/components/PostCard';
import { MonthFilter } from '@/components/MonthFilter';
import { PaymentButton } from '@/components/PaymentButton';
import type { PostPreview, MonthGroup } from '@/types';

export default function HomePage() {
  const { isPremium, isConnected, isAdmin } = useWallet();
  const { selectedMonth, setSettings } = useAppStore();
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [months, setMonths] = useState<MonthGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const settingsResponse = await getSettings();
      if (settingsResponse.success && settingsResponse.data) {
        setSettings(settingsResponse.data);
      }

      const postsResponse = await getPosts(selectedMonth || undefined);
      if (postsResponse.success && postsResponse.data) {
        setPosts(postsResponse.data.posts);
        setMonths(postsResponse.data.months);
      }

      setLoading(false);
    }

    loadData();
  }, [selectedMonth, setSettings]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-accent-gold/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent-emerald/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-gold/10 border border-accent-gold/20 mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
              <span className="text-sm text-accent-gold font-medium">Proven Track Record</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-6 animate-slide-up">
              Stop Losing Money to{' '}
              <span className="gradient-text">Market Noise</span>
            </h1>

            <p className="text-lg sm:text-xl text-text-secondary mb-10 leading-relaxed animate-slide-up stagger-1">
              Hussayn Signal drops the alpha that actually prints. No fluff, no hopium —
              just battle-tested calls from a Degen who&apos;s seen it all.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-2">
              {isPremium || isAdmin ? (
                <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30">
                  <svg className="w-5 h-5 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-accent-emerald font-medium">
                    {isAdmin ? 'Admin Access' : 'You have Premium Access'}
                  </span>
                </div>
              ) : (
                <>
                  <PaymentButton className="w-full sm:w-auto px-8 py-4 text-lg" />
                  <Link href="/wins" className="btn btn-secondary w-full sm:w-auto px-8 py-4 text-lg">
                    See Our Wins
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 animate-slide-up stagger-3">
            {[
              { value: '20K+', label: 'X Followers' },
              { value: '1.7K+', label: 'Telegram Members' },
              { value: '90%+', label: 'Win Rate' },
              { value: '5Y+', label: 'Track Record' },
            ].map((stat, index) => (
              <div key={index} className="text-center p-6 rounded-xl bg-bg-card border border-border-subtle">
                <div className="font-display text-3xl font-bold gradient-text mb-1">{stat.value}</div>
                <div className="text-text-secondary text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Posts Section */}
      <section className="py-20 bg-bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <h2 className="font-display text-3xl font-bold text-text-primary mb-2">Latest Signals</h2>
              <p className="text-text-secondary">
                {isPremium ? 'Full access to all premium content' : 'Preview our latest calls — unlock full access with Premium'}
              </p>
            </div>
            <MonthFilter months={months} />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card p-6 space-y-4">
                  <div className="skeleton h-6 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-20 w-full" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-text-muted text-lg">No posts yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} isPremium={isPremium || isAdmin} locked={!isPremium && !isAdmin} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      {!isPremium && !isAdmin && (
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-2xl bg-gradient-to-br from-bg-card to-bg-tertiary border border-border-subtle p-10 md:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-gold/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
              </div>

              <div className="relative">
                <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-4">
                  Ready to Stack Some Wins?
                </h2>
                <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
                  Join the Hussayn Signal fam and get the edge that degens dream about.
                  Premium calls, full transparency, real results.
                </p>
                <PaymentButton className="px-10 py-4 text-lg" />
                <p className="mt-4 text-text-muted text-sm">
                  30-day access • Instant activation • No refunds
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

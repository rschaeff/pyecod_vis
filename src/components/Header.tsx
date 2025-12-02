'use client';

/**
 * Header component with curator authentication display
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoginModal from './LoginModal';

interface Curator {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
}

export default function Header() {
  const [curator, setCurator] = useState<Curator | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (data.authenticated) {
        setCurator(data.curator);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurator(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleLoginSuccess = (curatorData: { id: number; username: string; display_name: string }) => {
    // LoginModal returns a subset of Curator fields, set email to null
    setCurator({ ...curatorData, email: null });
    setShowLoginModal(false);
  };

  return (
    <>
      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Title */}
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-bold">
                ECOD Curation
              </Link>

              {/* Navigation */}
              <nav className="flex space-x-4">
                <Link
                  href="/queue"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  Queue
                </Link>
                <Link
                  href="/browse"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  Browse
                </Link>
                <Link
                  href="/validation"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  Rep Validation
                </Link>
                <Link
                  href="/clustering-validation"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  Clustering Validation
                </Link>
                <Link
                  href="/swissprot"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  SwissProt Novel
                </Link>
                <Link
                  href="/problematic-hgroups"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  Problematic H-Groups
                </Link>
                <Link
                  href="/stats"
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
                >
                  Statistics
                </Link>
              </nav>
            </div>

            {/* Auth Section */}
            <div className="flex items-center space-x-4">
              {loading ? (
                <span className="text-sm opacity-90">Loading...</span>
              ) : curator ? (
                <>
                  <span className="text-sm opacity-90">{curator.display_name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm opacity-75 hover:opacity-100"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="text-sm bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded transition-colors"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </>
  );
}

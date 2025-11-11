'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700';
  };

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              ECOD Curation
            </Link>

            <div className="flex space-x-4">
              <Link
                href="/queue"
                className={`${isActive('/queue')} px-4 py-2 rounded transition-colors`}
              >
                Queue
              </Link>

              <Link
                href="/browse"
                className={`${isActive('/browse')} px-4 py-2 rounded transition-colors`}
              >
                Browse
              </Link>

              <Link
                href="/validation"
                className={`${isActive('/validation')} px-4 py-2 rounded transition-colors`}
              >
                Validation
              </Link>

              <Link
                href="/stats"
                className={`${isActive('/stats')} px-4 py-2 rounded transition-colors`}
              >
                Statistics
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm opacity-90">rschaeff</span>
            <button className="text-sm opacity-75 hover:opacity-100">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

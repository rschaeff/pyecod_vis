import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            ECOD Curation
          </h1>
          <p className="text-xl text-gray-600">
            Manual domain boundary review and classification assignment
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Link
            href="/queue"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-4xl mb-3">📋</div>
            <h2 className="text-xl font-semibold mb-2">Queue</h2>
            <p className="text-gray-600">
              View proteins pending curation and start reviewing
            </p>
          </Link>

          <Link
            href="/browse"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-4xl mb-3">🔍</div>
            <h2 className="text-xl font-semibold mb-2">Browse</h2>
            <p className="text-gray-600">
              Search and explore curated proteins
            </p>
          </Link>

          <Link
            href="/stats"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-4xl mb-3">📊</div>
            <h2 className="text-xl font-semibold mb-2">Statistics</h2>
            <p className="text-gray-600">
              Track curation progress and metrics
            </p>
          </Link>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Phase 1: MVP Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Curation queue with protein list</li>
            <li>✓ Protein detail view with domain boundaries</li>
            <li>✓ Evidence display (BLAST/HHsearch hits)</li>
            <li>✓ Manual boundary editing</li>
            <li>✓ Approve/reject workflow</li>
            <li>○ 3D structure viewer (coming soon)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">EVE Online Personal Killboard</h1>
        <p className="text-xl text-gray-300 mb-8">
          Track your solo kills, losses, and final blows with faction-themed styling
        </p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors inline-block"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}
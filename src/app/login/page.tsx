import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          EVE Online Personal Killboard
        </h1>
        <p className="text-gray-300 mb-6 text-center">
          Track your solo kills, losses, and final blows with faction-themed styling
        </p>
        <Link 
          href="/api/auth/login"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg block text-center transition-colors"
        >
          Login with EVE Online SSO
        </Link>
      </div>
    </div>
  )
}
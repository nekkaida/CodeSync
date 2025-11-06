export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            CodeSync
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-300 mb-8">
            Real-time Collaborative Code Editor
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-12">
            Figma for Code - Collaborate with your team in real-time
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Real-time Sync</h3>
              <p className="text-gray-600 dark:text-gray-400">
                See changes instantly with CRDT-powered collaboration
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Live Chat</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Communicate with your team while coding together
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold mb-2">Modern Editor</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Powered by Monaco - the same editor as VS Code
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <a
              href="/login"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
            </a>
            <a
              href="/register"
              className="px-8 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded-lg font-semibold border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
            >
              Sign Up
            </a>
          </div>

          <div className="mt-12 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-500">
            <h3 className="text-xl font-semibold text-green-800 dark:text-green-300 mb-2">
              ✅ Backend is Running!
            </h3>
            <p className="text-green-700 dark:text-green-400">
              API: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">http://localhost:4000</code>
              <br />
              Yjs WebSocket: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">ws://localhost:4001</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

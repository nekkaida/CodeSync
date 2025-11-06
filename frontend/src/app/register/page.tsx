import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            CodeSync
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Create your account and start collaborating</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">
          <RegisterForm />
        </div>

        <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          <a href="/" className="hover:underline">
            ← Back to home
          </a>
        </p>
      </div>
    </div>
  );
}

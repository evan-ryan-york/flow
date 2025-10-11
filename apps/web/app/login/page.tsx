import { Suspense } from 'react';
import { LoginForm } from './components/LoginForm';

// Force dynamic rendering for auth pages
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  // For now, skip server-side user check to focus on client-side auth flow

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Perfect Task App</h1>
          <p className="mt-2 text-sm text-gray-600">
            Ultimate task and project management with calendar integration
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Suspense fallback={<div className="text-center">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
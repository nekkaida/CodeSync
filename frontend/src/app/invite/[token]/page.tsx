'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

interface InvitationData {
  id: string;
  email: string;
  role: string;
  session: {
    id: string;
    name: string;
    description: string;
    language: string;
    owner: {
      name: string;
    };
  };
  expires_at: string;
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/verify/${params.token}`,
        );

        if (!response.ok) {
          throw new Error('Invalid or expired invitation');
        }

        const data = await response.json();
        setInvitation(data.data.invitation);
      } catch (err: any) {
        setError(err.message || 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [params.token]);

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/invite/${params.token}`);
      return;
    }

    setAccepting(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/accept/${params.token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: user.email }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to accept invitation');
      }

      // Redirect to session
      router.push(`/session/${invitation?.session.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error || 'This invitation is no longer valid'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-2">You've been invited!</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {invitation.session.owner.name} invited you to collaborate
          </p>
        </div>

        {/* Session Info */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 space-y-3">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Session</div>
            <div className="font-semibold">{invitation.session.name}</div>
            {invitation.session.description && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {invitation.session.description}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Language</div>
              <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded">
                {invitation.session.language}
              </span>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Your Role</div>
              <span className="px-2 py-1 text-xs bg-green-600/20 text-green-600 dark:text-green-400 rounded">
                {invitation.role}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Invited Email</div>
            <div className="text-sm">{invitation.email}</div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-500 rounded-lg text-red-700 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* User Status */}
        {!user && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm mb-4">
            You need to sign in to accept this invitation
          </div>
        )}

        {user && user.email !== invitation.email && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm mb-4">
            This invitation is for {invitation.email}, but you are signed in as {user.email}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={accepting || (user && user.email !== invitation.email)}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {accepting ? 'Accepting...' : user ? 'Accept Invitation' : 'Sign In to Accept'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Decline
          </button>
        </div>

        {/* Expiry */}
        <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          Expires {new Date(invitation.expires_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

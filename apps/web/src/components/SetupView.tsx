/**
 * Phantom Messenger - Invitation Access View
 * 
 * Secure invitation-based authentication
 */

import { useState, useEffect } from 'react';
import { identityService } from '../services/identity';
import { wsClient } from '../services/websocket';
import { useIdentityStore, useConnectionStore, useUIStore } from '../store';

// Icons as inline SVG components
const ShieldLockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
    <path d="M12 12h-2v-2h2v2zm0-3h-2V7h2v2z" />
  </svg>
);

const KeyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 10h-8.35C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H13l2 2 2-2 2 2 2-2v-4zm-14 2c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2z" />
  </svg>
);

const PasswordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 17h20v2H2v-2zm1.15-4.05L4 11.47l.85 1.48 1.3-.75-.85-1.48H7v-1.5H5.3l.85-1.47L4.85 7 4 8.47 3.15 7l-1.3.75.85 1.47H1v1.5h1.7l-.85 1.48 1.3.75zm6.7 0l.85-1.48.85 1.48 1.3-.75-.85-1.48H13v-1.5h-1.7l.85-1.47-1.3-.75L10 8.47 9.15 7l-1.3.75.85 1.47H7v1.5h1.7l-.85 1.48 1.3.75zm6.7 0l.85-1.48.85 1.48 1.3-.75-.85-1.48H20v-1.5h-1.7l.85-1.47-1.3-.75L17 8.47 16.15 7l-1.3.75.85 1.47H14v1.5h1.7l-.85 1.48 1.3.75z" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
);

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" />
  </svg>
);

export function SetupView() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const identity = useIdentityStore((state) => state.identity);
  const connectionStatus = useConnectionStore((state) => state.status);
  const setView = useUIStore((state) => state.setView);

  // Auto-connect if we have an identity
  useEffect(() => {
    if (identity && connectionStatus === 'disconnected') {
      handleLogin();
    }
  }, [identity]);

  // Navigate to chat when authenticated
  useEffect(() => {
    if (connectionStatus === 'authenticated') {
      setView('chat');
    }
  }, [connectionStatus, setView]);

  const handleLogin = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }
    if (inviteCode.replace(/-/g, '').length < 8) {
      setError('Invalid invitation code format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Initialize identity with invite code as seed for deterministic key generation
      await identityService.initialize(inviteCode, inviteCode);

      // Connect to server
      await wsClient.connect();
      await wsClient.authenticate();
    } catch (err) {
      setError('Invalid invitation code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const formatInviteCode = (value: string) => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Add dashes every 4 characters
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.slice(0, 3).join('-');
  };

  const handleInviteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteCode(formatInviteCode(e.target.value));
  };

  return (
    <div className="min-h-screen flex w-full bg-dark-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0a1016]">
        {/* Background Gradient Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-phantom-500/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-500/10 blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-16 w-full h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-phantom-500 text-white shadow-lg shadow-phantom-500/40">
              <ShieldLockIcon className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Phantom</span>
          </div>

          {/* Hero Text */}
          <div className="space-y-6">
            <h1 className="text-5xl font-extrabold leading-tight text-white">
              Private messaging,<br />
              <span className="text-phantom-500">invitation only.</span>
            </h1>
            <p className="text-lg text-dark-400 max-w-md">
              Zero knowledge architecture. End-to-end encryption. No server logs. Your identity is disposable and generated on entry.
            </p>
          </div>

          {/* Footer Links */}
          <div className="flex items-center gap-4 text-sm text-dark-500 font-medium">
            <span>© 2024 Phantom Messenger</span>
            <span className="w-1 h-1 rounded-full bg-dark-600" />
            <a className="hover:text-phantom-500 transition-colors cursor-pointer">Manifesto</a>
            <span className="w-1 h-1 rounded-full bg-dark-600" />
            <a className="hover:text-phantom-500 transition-colors cursor-pointer">Security</a>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-24 w-full bg-dark-950 relative">
        {/* Mobile Logo */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-phantom-500 text-white">
            <ShieldLockIcon className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-white">Phantom</span>
        </div>

        <div className="w-full max-w-[440px] flex flex-col gap-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-phantom-500/10 text-phantom-500 mb-4">
              <KeyIcon className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Invitation Access</h2>
            <p className="text-dark-400 max-w-xs mx-auto">Enter your secure code to generate a disposable identity.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-300 ml-1" htmlFor="invite-code">
                Secure Invitation Code
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-400 group-focus-within:text-phantom-500 transition-colors">
                  <PasswordIcon className="w-5 h-5" />
                </div>
                <input
                  id="invite-code"
                  type="text"
                  value={inviteCode}
                  onChange={handleInviteCodeChange}
                  placeholder="XXXX-XXXX-XXXX"
                  autoComplete="off"
                  autoFocus
                  className="w-full bg-dark-800 border border-dark-700 text-white placeholder:text-dark-500 text-lg font-mono tracking-wider rounded-full py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-phantom-500/50 focus:border-phantom-500 transition-all duration-200 uppercase"
                />
              </div>
              <p className="text-xs text-dark-500 ml-2">Codes are case-sensitive and single-use only.</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-2xl p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full bg-phantom-500 hover:bg-phantom-400 text-white font-bold text-base py-4 px-6 rounded-full shadow-lg shadow-phantom-500/20 hover:shadow-phantom-500/40 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Identity...
                </span>
              ) : (
                <>
                  <span>Generate Identity & Enter</span>
                  <ArrowIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div className="rounded-2xl bg-dark-900 p-5 border border-dark-700 flex gap-4 items-start">
            <InfoIcon className="w-5 h-5 text-dark-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-dark-400 leading-relaxed">
              <strong className="text-dark-200">Anonymous Access:</strong>{' '}
              We do not collect email addresses or phone numbers. A unique, disposable ID will be assigned to this session.
            </div>
          </div>

          {/* Help Link */}
          <div className="text-center">
            <a className="text-sm font-medium text-dark-400 hover:text-phantom-500 transition-colors cursor-pointer">
              How do I get an invitation?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

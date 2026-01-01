/**
 * Phantom Messenger - Login View
 * 
 * Username/Password based authentication with deterministic identity
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

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
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

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
  </svg>
);

export function SetupView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const identity = useIdentityStore((state) => state.identity);
  const connectionStatus = useConnectionStore((state) => state.status);
  const setView = useUIStore((state) => state.setView);

  // Auto-connect if we have an identity
  useEffect(() => {
    if (identity && connectionStatus === 'disconnected') {
      handleAutoConnect();
    }
  }, [identity]);

  // Navigate to chat when authenticated
  useEffect(() => {
    if (connectionStatus === 'authenticated') {
      setView('chat');
    }
  }, [connectionStatus, setView]);

  const handleAutoConnect = async () => {
    try {
      await wsClient.connect();
      await wsClient.authenticate();
    } catch (err) {
      console.error('Auto-connect failed:', err);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Initialize identity with username/password for deterministic key generation
      await identityService.initialize(username.trim(), password);

      // Connect to server
      await wsClient.connect();
      await wsClient.authenticate();
    } catch (err) {
      setError('Failed to login. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
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
              Secure chat,<br />
              <span className="text-phantom-500">zero knowledge.</span>
            </h1>
            <p className="text-lg text-dark-400 max-w-md">
              End-to-end encryption. No server logs. Your identity is deterministic — same credentials, same identity on any device.
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
              <LockIcon className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
            <p className="text-dark-400 max-w-xs mx-auto">Sign in to access your encrypted messages.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-300 ml-1" htmlFor="username">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-400 group-focus-within:text-phantom-500 transition-colors">
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  className="w-full bg-dark-800 border border-dark-700 text-white placeholder:text-dark-500 text-base rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-phantom-500/50 focus:border-phantom-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-300 ml-1" htmlFor="password">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-dark-400 group-focus-within:text-phantom-500 transition-colors">
                  <LockIcon className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-dark-800 border border-dark-700 text-white placeholder:text-dark-500 text-base rounded-xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-phantom-500/50 focus:border-phantom-500 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-dark-400 hover:text-dark-200 transition-colors"
                >
                  {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full bg-phantom-500 hover:bg-phantom-400 text-white font-bold text-base py-4 px-6 rounded-xl shadow-lg shadow-phantom-500/20 hover:shadow-phantom-500/40 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Info Box */}
          <div className="rounded-xl bg-dark-900 p-5 border border-dark-700 flex gap-4 items-start">
            <InfoIcon className="w-5 h-5 text-dark-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-dark-400 leading-relaxed">
              <strong className="text-dark-200">Deterministic Identity:</strong>{' '}
              Your identity is cryptographically derived from your credentials. Same username + password = same identity on any device.
            </div>
          </div>

          {/* New User Notice */}
          <div className="text-center text-sm text-dark-400">
            New user? Just enter your desired credentials — your identity will be created automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

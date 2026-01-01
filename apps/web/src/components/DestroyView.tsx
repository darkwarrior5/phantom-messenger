/**
 * Phantom Messenger - Destroy View
 * 
 * Identity destruction confirmation
 */

import { useState } from 'react';
import { FireIcon, ShieldIcon, TrashIcon } from './Icons';
import { useUIStore, useIdentityStore, useConversationsStore, useMessagesStore } from '../store';
import { identityService } from '../services/identity';
import { wsClient } from '../services/websocket';

export function DestroyView() {
  const setView = useUIStore((state) => state.setView);
  const clearIdentity = useIdentityStore((state) => state.clearIdentity);
  const clearConversations = useConversationsStore((state) => state.clear);
  const clearMessages = useMessagesStore((state) => state.clear);
  
  const [confirmText, setConfirmText] = useState('');
  const [destroying, setDestroying] = useState(false);
  const [step, setStep] = useState<'warning' | 'confirm' | 'destroying' | 'complete'>('warning');

  const CONFIRM_PHRASE = 'DESTROY';

  const handleDestroy = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;

    setDestroying(true);
    setStep('destroying');

    try {
      // Disconnect from server
      wsClient.disconnect();

      // Destroy identity securely
      identityService.destroyIdentity();

      // Clear all stores
      clearIdentity();
      clearConversations();
      clearMessages();

      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();

      // Show completion
      setStep('complete');

      // Redirect to setup after delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Failed to destroy identity:', err);
      setDestroying(false);
      setStep('warning');
    }
  };

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <ShieldIcon className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-green-400">
            Identity Destroyed
          </h1>
          <p className="text-dark-400">
            All data has been securely wiped. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  if (step === 'destroying') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <FireIcon className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4">
            Destroying Identity...
          </h1>
          <div className="space-y-2 text-dark-400 text-sm">
            <p className="animate-pulse">🔥 Wiping encryption keys...</p>
            <p className="animate-pulse delay-200">🔥 Clearing messages...</p>
            <p className="animate-pulse delay-400">🔥 Removing all traces...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        {step === 'warning' ? (
          <>
            {/* Warning Step */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                <TrashIcon className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold mb-4 text-red-400">
                Destroy Identity?
              </h1>
              <p className="text-dark-400">
                This action will permanently delete your identity and all associated data.
              </p>
            </div>

            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-red-400 mb-2">
                What will be destroyed:
              </h3>
              <ul className="text-dark-300 text-sm space-y-1">
                <li>• Your unique identifier</li>
                <li>• All encryption keys</li>
                <li>• All conversations and messages</li>
                <li>• All pending invitations</li>
                <li>• Connection history</li>
              </ul>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-yellow-400 mb-2">
                ⚠️ This cannot be undone
              </h3>
              <p className="text-yellow-500/80 text-sm">
                Your contacts will no longer be able to message you. You will need 
                to create a new identity and re-establish all connections.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setView('settings')}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="btn-ghost flex-1 text-red-400 hover:bg-red-900/20"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Confirm Step */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                <FireIcon className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold mb-4">
                Final Confirmation
              </h1>
              <p className="text-dark-400">
                Type <span className="font-mono font-bold text-red-400">{CONFIRM_PHRASE}</span> to confirm destruction
              </p>
            </div>

            <div className="mb-6">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder={`Type ${CONFIRM_PHRASE} here`}
                className="input text-center font-mono text-lg"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('warning');
                  setConfirmText('');
                }}
                className="btn-secondary flex-1"
              >
                Go Back
              </button>
              <button
                onClick={handleDestroy}
                disabled={confirmText !== CONFIRM_PHRASE || destroying}
                className="flex-1 py-3 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {destroying ? 'Destroying...' : 'Destroy Forever'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

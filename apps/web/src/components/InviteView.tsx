/**
 * Phantom Messenger - Invite View
 * 
 * Create and share invitations
 */

import { useState } from 'react';
import { 
  ShieldIcon, 
  CopyIcon, 
  CheckIcon, 
  PlusIcon 
} from './Icons';
import { useUIStore } from '../store';
import { generateInvitation } from '@phantom/crypto';
import { identityService } from '../services/identity';

export function InviteView() {
  const setView = useUIStore((state) => state.setView);
  const [invitation, setInvitation] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInvitation = async () => {
    setGenerating(true);
    setError(null);

    try {
      const identity = identityService.getCurrentIdentity();
      if (!identity) {
        throw new Error('No identity found');
      }

      // Generate secure invitation
      const result = await generateInvitation(identity);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate invitation');
      }

      setInvitation(result.data.invitationCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invitation');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!invitation) return;

    try {
      await navigator.clipboard.writeText(invitation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-phantom-900/50 flex items-center justify-center mx-auto mb-4">
            <PlusIcon className="w-8 h-8 text-phantom-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Create Invitation</h1>
          <p className="text-dark-400 text-sm">
            Generate a secure invitation code to share with someone you want to message
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {!invitation ? (
          /* Generate Invitation */
          <div className="space-y-4">
            <div className="bg-dark-800/50 rounded-lg p-4">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                <ShieldIcon className="w-4 h-4 text-phantom-400" />
                How it works
              </h3>
              <ul className="text-dark-400 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-phantom-500">1.</span>
                  Generate a unique invitation code
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-phantom-500">2.</span>
                  Share the code securely with your contact
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-phantom-500">3.</span>
                  They enter the code to establish a secure connection
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-phantom-500">4.</span>
                  Start messaging with end-to-end encryption
                </li>
              </ul>
            </div>

            <button
              onClick={handleGenerateInvitation}
              disabled={generating}
              className="btn-primary w-full"
            >
              {generating ? 'Generating...' : 'Generate Invitation Code'}
            </button>
          </div>
        ) : (
          /* Show Invitation Code */
          <div className="space-y-4">
            <div className="bg-dark-800/50 rounded-lg p-4">
              <label className="block text-sm text-dark-400 mb-2">
                Invitation Code
              </label>
              <div className="relative">
                <textarea
                  value={invitation}
                  readOnly
                  rows={4}
                  className="input font-mono text-sm pr-12 resize-none"
                  aria-label="Invitation code"
                />
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-2 btn-ghost p-2"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <CopyIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-green-400 text-xs mt-2">Copied to clipboard!</p>
              )}
            </div>

            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
              <h4 className="font-medium text-yellow-400 text-sm mb-1">
                Security Notice
              </h4>
              <p className="text-yellow-500/80 text-xs">
                Share this code through a secure channel. Anyone with this code can 
                establish a connection with you. The code is single-use and expires 
                after 24 hours.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInvitation(null);
                  setCopied(false);
                }}
                className="btn-secondary flex-1"
              >
                Generate New
              </button>
              <button
                onClick={() => setView('chat')}
                className="btn-primary flex-1"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => setView('chat')}
          className="w-full mt-4 text-dark-400 text-sm hover:text-dark-200 transition-colors"
        >
          ← Back to Chat
        </button>
      </div>
    </div>
  );
}

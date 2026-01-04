/**
 * Phantom Messenger - Accept Invitation Modal
 * 
 * UI for entering and accepting invitation codes
 */

import { useState } from 'react';
import {
    ShieldIcon,
    XIcon,
    CheckIcon,
    UserIcon
} from './Icons';
import { acceptInvitation, type Profile } from '../services/supabaseClient';
import { useConversationsStore } from '../store';
import type { Conversation } from '@phantom/shared';

interface AcceptInvitationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (profile: Profile) => void;
}

export function AcceptInvitationModal({ isOpen, onClose, onSuccess }: AcceptInvitationModalProps) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<Profile | null>(null);

    const addConversation = useConversationsStore((state) => state.addConversation);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!code.trim()) {
            setError('Please enter an invitation code');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await acceptInvitation(code.trim());

            if (!result.success) {
                setError(result.error || 'Failed to accept invitation');
                return;
            }

            if (result.creatorProfile) {
                setSuccess(result.creatorProfile);

                // Create a new conversation with the connected user
                if (result.creatorProfile.public_key) {
                    const conversation: Conversation = {
                        id: result.creatorProfile.public_key,
                        participants: [result.creatorProfile.public_key],
                        type: 'direct',
                        createdAt: Date.now(),
                        unreadCount: 0,
                        state: 'active',
                        keyExchangeComplete: false
                    };
                    addConversation(conversation);
                }

                setTimeout(() => {
                    onSuccess(result.creatorProfile!);
                    onClose();
                }, 1500);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to accept invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCode('');
        setError(null);
        setSuccess(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 rounded-2xl max-w-md w-full p-6 border border-dark-700 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-phantom-900/50 flex items-center justify-center">
                            <ShieldIcon className="w-5 h-5 text-phantom-400" />
                        </div>
                        <h2 className="text-xl font-bold">Accept Invitation</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="btn-ghost p-2 text-dark-400 hover:text-dark-200"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {success ? (
                    /* Success State */
                    <div className="text-center py-6">
                        <div className="w-16 h-16 rounded-full bg-green-900/50 flex items-center justify-center mx-auto mb-4">
                            <CheckIcon className="w-8 h-8 text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-green-400 mb-2">Connected!</h3>
                        <div className="flex items-center justify-center gap-2 text-dark-300">
                            <UserIcon className="w-4 h-4" />
                            <span>{success.username}</span>
                        </div>
                        <p className="text-dark-400 text-sm mt-2">
                            You can now exchange encrypted messages
                        </p>
                    </div>
                ) : (
                    /* Form State */
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-dark-400 mb-2">
                                Invitation Code
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="PHM-XXXX-XXXX-XXXX-XXXX"
                                className="input w-full font-mono text-sm"
                                autoFocus
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="bg-dark-800/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-dark-300 mb-2">How it works</h4>
                            <ul className="text-dark-400 text-xs space-y-1">
                                <li>• Someone shared their invitation code with you</li>
                                <li>• Enter the code to establish a secure connection</li>
                                <li>• Once connected, you can exchange encrypted messages</li>
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="btn-secondary flex-1"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary flex-1"
                                disabled={loading || !code.trim()}
                            >
                                {loading ? 'Connecting...' : 'Connect'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

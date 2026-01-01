/**
 * Phantom Messenger - Settings View
 * 
 * User preferences and settings
 */

import { useState } from 'react';
import { 
  SettingsIcon, 
  ShieldIcon, 
  FireIcon, 
  TrashIcon,
  UserIcon 
} from './Icons';
import { useUIStore, usePreferencesStore, useIdentityStore } from '../store';
import { identityService } from '../services/identity';

export function SettingsView() {
  const setView = useUIStore((state) => state.setView);
  const preferences = usePreferencesStore((state) => state.preferences);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);
  const identity = useIdentityStore((state) => state.identity);

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-phantom-900/50 flex items-center justify-center mx-auto mb-4">
            <SettingsIcon className="w-8 h-8 text-phantom-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Settings</h1>
          <p className="text-dark-400 text-sm">
            Configure your privacy and security preferences
          </p>
        </div>

        {/* Identity Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Identity
          </h2>
          <div className="bg-dark-800/50 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs text-dark-500 mb-1">Your ID</label>
              <p className="font-mono text-sm truncate">
                {identityService.getDisplayId()}
              </p>
            </div>
            <div>
              <label className="block text-xs text-dark-500 mb-1">Created</label>
              <p className="text-sm">
                {identity?.createdAt 
                  ? new Date(identity.createdAt).toLocaleString()
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
            <ShieldIcon className="w-4 h-4" />
            Security
          </h2>
          <div className="bg-dark-800/50 rounded-lg divide-y divide-dark-700">
            <SettingToggle
              label="Auto-delete messages"
              description="Automatically delete messages after they've been read"
              checked={preferences.autoDeleteMessages}
              onChange={(checked) => updatePreferences({ autoDeleteMessages: checked })}
            />
            <SettingToggle
              label="Show read receipts"
              description="Let others know when you've read their messages"
              checked={preferences.showReadReceipts}
              onChange={(checked) => updatePreferences({ showReadReceipts: checked })}
            />
            <SettingToggle
              label="Show typing indicator"
              description="Let others know when you're typing"
              checked={preferences.showTypingIndicator}
              onChange={(checked) => updatePreferences({ showTypingIndicator: checked })}
            />
          </div>
        </div>

        {/* Message Settings */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
            <FireIcon className="w-4 h-4" />
            Messages
          </h2>
          <div className="bg-dark-800/50 rounded-lg p-4">
            <label className="block text-sm mb-2">Auto-delete timeout (seconds)</label>
            <select
              value={preferences.autoDeleteTimeout || 30}
              onChange={(e) => updatePreferences({ autoDeleteTimeout: Number(e.target.value) })}
              className="input"
              aria-label="Auto-delete timeout"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={86400}>24 hours</option>
              <option value={604800}>7 days</option>
            </select>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <TrashIcon className="w-4 h-4" />
            Danger Zone
          </h2>
          <div className="bg-red-900/10 border border-red-800/50 rounded-lg p-4 space-y-3">
            <p className="text-dark-400 text-sm">
              Destroying your identity will permanently delete all your data including 
              messages, conversations, and encryption keys. This action cannot be undone.
            </p>
            <button
              onClick={() => setView('destroy')}
              className="btn-ghost w-full text-red-400 hover:bg-red-900/20"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Destroy Identity
            </button>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => setView('chat')}
          className="btn-secondary w-full"
        >
          ← Back to Chat
        </button>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="pr-4">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-dark-400 text-xs mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-phantom-600' : 'bg-dark-600'
        }`}
        aria-label={`Toggle ${label}`}
        aria-checked={checked}
        role="switch"
        type="button"
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

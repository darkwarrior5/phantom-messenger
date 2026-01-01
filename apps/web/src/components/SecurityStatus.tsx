/**
 * Phantom Messenger - Security Status Component
 */

import { ShieldIcon, LockIcon } from './Icons';

interface SecurityStatusProps {
  isEncrypted: boolean;
  isPFS: boolean;
  fingerprint?: string;
}

export function SecurityStatus({ isEncrypted, isPFS, fingerprint }: SecurityStatusProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-dark-800/50 rounded-lg">
      <div className={`flex items-center gap-1.5 ${isEncrypted ? 'text-green-400' : 'text-red-400'}`}>
        <LockIcon locked={isEncrypted} className="w-4 h-4" />
        <span className="text-xs font-medium">
          {isEncrypted ? 'E2E Encrypted' : 'Not Encrypted'}
        </span>
      </div>
      
      {isPFS && (
        <>
          <span className="text-dark-600">•</span>
          <div className="flex items-center gap-1.5 text-phantom-400">
            <ShieldIcon className="w-4 h-4" />
            <span className="text-xs font-medium">PFS Active</span>
          </div>
        </>
      )}
      
      {fingerprint && (
        <button
          className="ml-auto text-xs text-dark-400 hover:text-dark-200 font-mono"
          onClick={() => navigator.clipboard.writeText(fingerprint)}
          title="Click to copy fingerprint"
        >
          {fingerprint.slice(0, 16)}...
        </button>
      )}
    </div>
  );
}

/**
 * Security Badge Component
 */
interface SecurityBadgeProps {
  type: 'encrypted' | 'pfs' | 'verified' | 'burn';
  small?: boolean;
}

export function SecurityBadge({ type, small = false }: SecurityBadgeProps) {
  const configs = {
    encrypted: {
      icon: <LockIcon locked className={small ? 'w-3 h-3' : 'w-4 h-4'} />,
      label: 'Encrypted',
      className: 'badge-success'
    },
    pfs: {
      icon: <ShieldIcon className={small ? 'w-3 h-3' : 'w-4 h-4'} />,
      label: 'PFS',
      className: 'badge-info'
    },
    verified: {
      icon: <ShieldIcon className={small ? 'w-3 h-3' : 'w-4 h-4'} />,
      label: 'Verified',
      className: 'badge-success'
    },
    burn: {
      icon: null,
      label: '🔥',
      className: 'badge-warning'
    }
  };

  const config = configs[type];

  return (
    <span className={`${config.className} gap-1 ${small ? 'text-[10px] px-1.5 py-0.5' : ''}`}>
      {config.icon}
      {!small && <span>{config.label}</span>}
    </span>
  );
}

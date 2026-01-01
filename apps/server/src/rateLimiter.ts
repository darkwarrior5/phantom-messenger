/**
 * Phantom Messenger Server - Rate Limiter
 * 
 * Privacy-preserving rate limiting using hashed IP addresses
 */

import { createHash } from 'crypto';
import type { RateLimitEntry } from './types.js';

export class RateLimiter {
  private limits: Map<string, Map<string, RateLimitEntry>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Hash an IP address for privacy
   * We never store raw IP addresses
   */
  hashIP(ip: string): string {
    return createHash('sha256')
      .update(ip)
      .update(process.env['RATE_LIMIT_SALT'] ?? 'phantom-salt')
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Check if action is rate limited
   */
  isRateLimited(
    ipHash: string,
    action: string,
    maxCount: number,
    windowMs: number
  ): boolean {
    const now = Date.now();
    
    if (!this.limits.has(ipHash)) {
      this.limits.set(ipHash, new Map());
    }
    
    const ipLimits = this.limits.get(ipHash)!;
    const entry = ipLimits.get(action);
    
    if (!entry || now > entry.resetAt) {
      // New window
      ipLimits.set(action, {
        count: 1,
        resetAt: now + windowMs
      });
      return false;
    }
    
    if (entry.count >= maxCount) {
      return true;
    }
    
    entry.count++;
    return false;
  }

  /**
   * Check connection rate limit
   */
  checkConnectionLimit(ipHash: string, maxConnections: number): boolean {
    return this.isRateLimited(ipHash, 'connection', maxConnections, 60000);
  }

  /**
   * Check message rate limit
   */
  checkMessageLimit(ipHash: string): boolean {
    return this.isRateLimited(ipHash, 'message', 60, 60000);
  }

  /**
   * Check authentication rate limit
   */
  checkAuthLimit(ipHash: string): boolean {
    return this.isRateLimited(ipHash, 'auth', 5, 60000);
  }

  /**
   * Reset limits for an IP (on successful auth)
   */
  resetForIP(ipHash: string, action: string): void {
    const ipLimits = this.limits.get(ipHash);
    if (ipLimits) {
      ipLimits.delete(action);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [ipHash, actions] of this.limits.entries()) {
      for (const [action, entry] of actions.entries()) {
        if (now > entry.resetAt) {
          actions.delete(action);
        }
      }
      
      if (actions.size === 0) {
        this.limits.delete(ipHash);
      }
    }
  }

  /**
   * Stop the rate limiter
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
  }
}

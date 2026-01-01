/**
 * Phantom Messenger - Media Service
 * 
 * Handles encrypted media upload/download
 * - Encrypts files before upload
 * - Auto-deletes from server after both users download
 */

import { 
  encryptMedia, 
  decryptMedia,
  bytesToBase64,
  base64ToBytes
} from '@phantom/crypto';
import type { EncryptedMedia } from '@phantom/crypto';
import { wsClient } from './websocket';
import { useIdentityStore } from '../store';

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name: string;
  size: number;
  mimeType: string;
  /** Local blob URL for preview */
  localUrl?: string;
  /** Server media ID for download */
  mediaId?: string;
  /** Upload progress (0-100) */
  uploadProgress?: number;
  /** Download progress (0-100) */
  downloadProgress?: number;
  /** Status */
  status: 'pending' | 'uploading' | 'uploaded' | 'downloading' | 'downloaded' | 'error';
  /** Error message if failed */
  error?: string;
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  encryptedKey?: string;
  iv?: string;
  ephemeralPublicKey?: string;
  error?: string | undefined;
}

export interface MediaDownloadResult {
  success: boolean;
  data?: Uint8Array;
  mimeType?: string;
  error?: string | undefined;
}

/** Max file size: 50MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Allowed MIME types */
const ALLOWED_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Videos
  'video/mp4',
  'video/webm',
  // Audio
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  // Documents
  'application/pdf',
  'text/plain',
  // Archives
  'application/zip'
]);

class MediaService {
  /**
   * Get media type from MIME type
   */
  getMediaType(mimeType: string): MediaAttachment['type'] {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File too large (max 50MB)' };
    }
    
    if (!ALLOWED_TYPES.has(file.type)) {
      return { valid: false, error: 'File type not supported' };
    }
    
    return { valid: true };
  }

  /**
   * Upload encrypted media to server
   */
  async uploadMedia(
    fileData: Uint8Array,
    recipientPublicKey: Uint8Array,
    fileName: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<MediaUploadResult> {
    try {
      // Validate size
      if (fileData.length > MAX_FILE_SIZE) {
        return { success: false, error: 'File too large (max 50MB)' };
      }

      if (!ALLOWED_TYPES.has(mimeType)) {
        return { success: false, error: 'File type not supported' };
      }

      onProgress?.(10);

      // Encrypt the file
      const encryptResult = await encryptMedia(fileData, recipientPublicKey);
      
      if (!encryptResult.success || !encryptResult.data) {
        return { success: false, error: 'Failed to encrypt file' };
      }

      onProgress?.(50);

      // Convert encrypted data to base64 for transmission
      const encryptedBase64 = bytesToBase64(encryptResult.data.encryptedData);

      // Send upload request
      const response = await wsClient.sendRequest<{
        mediaId?: string;
        error?: string;
      }>('media-upload', {
        recipientKey: bytesToBase64(recipientPublicKey),
        encryptedData: encryptedBase64,
        encryptedKey: encryptResult.data.encryptedKey,
        ephemeralPublicKey: encryptResult.data.ephemeralPublicKey,
        nonce: encryptResult.data.nonce,
        tag: encryptResult.data.tag,
        mimeType: mimeType,
        fileName: fileName,
        fileSize: fileData.length
      });

      onProgress?.(100);

      if (response.mediaId) {
        return { 
          success: true, 
          mediaId: response.mediaId,
          encryptedKey: encryptResult.data.encryptedKey,
          iv: encryptResult.data.nonce,
          ephemeralPublicKey: encryptResult.data.ephemeralPublicKey
        };
      }

      return { success: false, error: response.error || 'Upload failed' };
    } catch (error) {
      console.error('[Media] Upload error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Download and decrypt media from server
   */
  async downloadMedia(
    mediaId: string,
    privateKey: Uint8Array,
    encryptedKey: string,
    iv: string,
    onProgress?: (progress: number) => void
  ): Promise<MediaDownloadResult> {
    try {
      onProgress?.(10);

      // Request download from server
      const response = await wsClient.sendRequest<{
        encryptedData?: string;
        ephemeralPublicKey?: string;
        tag?: string;
        mimeType?: string;
        error?: string;
      }>('media-download', { mediaId });

      if (!response.encryptedData || !response.ephemeralPublicKey) {
        return { success: false, error: response.error || 'Download failed' };
      }

      onProgress?.(50);

      // Reconstruct encrypted media object
      const encryptedMedia: EncryptedMedia = {
        encryptedData: base64ToBytes(response.encryptedData),
        encryptedKey: encryptedKey,
        ephemeralPublicKey: response.ephemeralPublicKey,
        nonce: iv,
        tag: response.tag || ''
      };

      onProgress?.(70);

      // Decrypt the file
      const decryptResult = await decryptMedia(
        encryptedMedia,
        privateKey
      );

      if (!decryptResult.success || !decryptResult.data) {
        return { success: false, error: 'Failed to decrypt file' };
      }

      onProgress?.(100);

      return { 
        success: true, 
        data: decryptResult.data,
        mimeType: response.mimeType || 'application/octet-stream'
      };
    } catch (error) {
      console.error('[Media] Download error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Download failed' 
      };
    }
  }

  /**
   * Create a blob URL for preview
   */
  createBlobUrl(data: Uint8Array, mimeType: string): string {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Revoke a blob URL to free memory
   */
  revokeBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * Download file to user's device
   */
  downloadToDevice(data: Uint8Array, filename: string, mimeType: string): void {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
}

export const mediaService = new MediaService();

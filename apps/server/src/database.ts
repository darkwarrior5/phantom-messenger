/**
 * Phantom Messenger - Supabase Database Service
 * 
 * HYBRID MODE:
 * - Messages: Persist forever (for sync)
 * - Media: Delete after both users download
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface StoredMessage {
  id: string;
  sender_key: string;
  recipient_key: string;
  encrypted_content: string;
  message_type: 'text' | 'media' | 'file';
  media_id: string | null;
  created_at: string;
}

export interface StoredMedia {
  id: string;
  storage_path: string;
  encrypted_key: string;
  file_size: number;
  mime_type: string | null;
  sender_key: string;
  recipient_key: string;
  sender_downloaded: boolean;
  recipient_downloaded: boolean;
  expires_at: string;
  created_at: string;
}

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // =========================================
  // MESSAGES (Persistent)
  // =========================================

  /**
   * Store an encrypted message
   */
  async storeMessage(
    senderKey: string,
    recipientKey: string,
    encryptedContent: string,
    messageType: 'text' | 'media' | 'file' = 'text',
    mediaId?: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        sender_key: senderKey,
        recipient_key: recipientKey,
        encrypted_content: encryptedContent,
        message_type: messageType,
        media_id: mediaId || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Database] Failed to store message:', error.message);
      return null;
    }

    return data?.id || null;
  }

  /**
   * Get all messages for a user (for sync)
   */
  async getMessagesForUser(
    publicKey: string,
    sinceTimestamp?: string,
    limit = 1000
  ): Promise<StoredMessage[]> {
    let query = this.supabase
      .from('messages')
      .select('*')
      .or(`sender_key.eq.${publicKey},recipient_key.eq.${publicKey}`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (sinceTimestamp) {
      query = query.gt('created_at', sinceTimestamp);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Database] Failed to get messages:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(
    userAKey: string,
    userBKey: string,
    sinceTimestamp?: string,
    limit = 500
  ): Promise<StoredMessage[]> {
    let query = this.supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_key.eq.${userAKey},recipient_key.eq.${userBKey}),` +
        `and(sender_key.eq.${userBKey},recipient_key.eq.${userAKey})`
      )
      .order('created_at', { ascending: true })
      .limit(limit);

    if (sinceTimestamp) {
      query = query.gt('created_at', sinceTimestamp);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Database] Failed to get conversation:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Delete all messages for a user (burn everything)
   */
  async deleteAllForUser(publicKey: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('messages')
      .delete()
      .or(`sender_key.eq.${publicKey},recipient_key.eq.${publicKey}`)
      .select('id');

    if (error) {
      console.error('[Database] Failed to delete messages:', error.message);
      return 0;
    }

    return data?.length || 0;
  }

  // =========================================
  // MEDIA (Ephemeral - deletes after download)
  // =========================================

  /**
   * Store media metadata (file stored in Supabase Storage)
   */
  async storeMedia(
    storagePath: string,
    encryptedKey: string,
    fileSize: number,
    mimeType: string | null,
    senderKey: string,
    recipientKey: string
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('media')
      .insert({
        sender_key: senderKey,
        recipient_key: recipientKey,
        storage_path: storagePath,
        encrypted_key: encryptedKey,
        file_size: fileSize,
        mime_type: mimeType,
        sender_downloaded: true,  // Sender already has it
        recipient_downloaded: false
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Database] Failed to store media:', error.message);
      return null;
    }

    return data?.id || null;
  }

  /**
   * Get media metadata by ID
   */
  async getMedia(mediaId: string): Promise<StoredMedia | null> {
    const { data, error } = await this.supabase
      .from('media')
      .select('*')
      .eq('id', mediaId)
      .single();

    if (error) {
      console.error('[Database] Failed to get media:', error.message);
      return null;
    }

    return data;
  }

  /**
   * Mark media as downloaded by sender or recipient
   * This triggers auto-deletion via database trigger when both have downloaded
   */
  async markMediaDownloaded(mediaId: string, isSender: boolean): Promise<boolean> {
    const updateField = isSender
      ? { sender_downloaded: true }
      : { recipient_downloaded: true };

    const { error } = await this.supabase
      .from('media')
      .update(updateField)
      .eq('id', mediaId);

    if (error) {
      console.error('[Database] Failed to mark media downloaded:', error.message);
      return false;
    }

    return true;
  }

  /**
   * Get pending media for a user (not yet downloaded)
   */
  async getPendingMedia(recipientKey: string): Promise<StoredMedia[]> {
    const { data, error } = await this.supabase
      .from('media')
      .select('*')
      .eq('recipient_key', recipientKey)
      .eq('recipient_downloaded', false);

    if (error) {
      console.error('[Database] Failed to get pending media:', error.message);
      return [];
    }

    return data || [];
  }

  // =========================================
  // STORAGE (Encrypted file uploads)
  // =========================================

  /**
   * Upload encrypted file to Supabase Storage
   */
  async uploadMedia(
    encryptedData: Uint8Array,
    senderKey: string,
    recipientKey: string,
    mimeType: string
  ): Promise<{ path: string } | null> {
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.enc`;
    const storagePath = `${senderKey.slice(0, 16)}/${fileName}`;

    const { error } = await this.supabase.storage
      .from('encrypted-media')
      .upload(storagePath, encryptedData, {
        contentType: 'application/octet-stream',  // Always binary (encrypted)
        upsert: false
      });

    if (error) {
      console.error('[Storage] Failed to upload:', error.message);
      return null;
    }

    return { path: storagePath };
  }

  /**
   * Download encrypted file from Supabase Storage
   */
  async downloadMedia(storagePath: string): Promise<Uint8Array | null> {
    const { data, error } = await this.supabase.storage
      .from('encrypted-media')
      .download(storagePath);

    if (error) {
      console.error('[Storage] Failed to download:', error.message);
      return null;
    }

    return new Uint8Array(await data.arrayBuffer());
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteMediaFile(storagePath: string): Promise<boolean> {
    const { error } = await this.supabase.storage
      .from('encrypted-media')
      .remove([storagePath]);

    if (error) {
      console.error('[Storage] Failed to delete:', error.message);
      return false;
    }

    return true;
  }

  // =========================================
  // STATS
  // =========================================

  async getStats(): Promise<{ totalMessages: number; totalMedia: number }> {
    const [messagesResult, mediaResult] = await Promise.all([
      this.supabase.from('messages').select('id', { count: 'exact', head: true }),
      this.supabase.from('media').select('id', { count: 'exact', head: true })
    ]);

    return {
      totalMessages: messagesResult.count || 0,
      totalMedia: mediaResult.count || 0
    };
  }
}

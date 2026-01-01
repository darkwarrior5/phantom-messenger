/**
 * Phantom Messenger - Chat View
 * 
 * Main messaging interface
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  SendIcon, 
  FireIcon, 
  PlusIcon, 
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  ChatIcon,
  PaperclipIcon,
  ImageIcon,
  XIcon,
  DownloadIcon
} from './Icons';
import { SecurityStatus, SecurityBadge } from './SecurityStatus';
import { 
  useIdentityStore, 
  useConnectionStore, 
  useConversationsStore,
  useMessagesStore,
  useUIStore 
} from '../store';
import { identityService } from '../services/identity';
import { mediaService, type MediaAttachment } from '../services/media';
import { wsClient } from '../services/websocket';
import { formatTimestamp, generateRequestId } from '@phantom/shared';
import { encryptMessage, bytesToBase64, base64ToBytes } from '@phantom/crypto';
import type { Message, Conversation, MediaInfo } from '@phantom/shared';

export function ChatView() {
  const identity = useIdentityStore((state) => state.identity);
  const connectionStatus = useConnectionStore((state) => state.status);
  const conversations = useConversationsStore((state) => state.conversations);
  const activeConversationId = useConversationsStore((state) => state.activeConversationId);
  const setActiveConversation = useConversationsStore((state) => state.setActiveConversation);
  const messages = useMessagesStore((state) => state.messages);
  const setView = useUIStore((state) => state.setView);

  const currentUserId = identity?.id 
    ? new TextDecoder().decode(identity.id) 
    : '';

  const activeConversation = activeConversationId 
    ? conversations.get(activeConversationId) 
    : null;
  const conversationMessages = activeConversationId 
    ? messages.get(activeConversationId) ?? []
    : [];

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-80 bg-dark-900 border-r border-dark-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-dark-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-6 h-6 text-phantom-500" />
              <span className="font-bold text-lg">Phantom</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setView('invite')}
                className="btn-ghost p-2"
                title="Create Invitation"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setView('settings')}
                className="btn-ghost p-2"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Identity Info */}
          <div className="flex items-center gap-2 p-2 bg-dark-800/50 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-phantom-900 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-phantom-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm truncate">
                {identityService.getDisplayId()}
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'authenticated' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="text-xs text-dark-400">
                  {connectionStatus === 'authenticated' ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.size === 0 ? (
            <div className="text-center py-8">
              <ChatIcon className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400 text-sm">No conversations yet</p>
              <button
                onClick={() => setView('invite')}
                className="btn-primary mt-4"
              >
                Create Invitation
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from(conversations.values()).map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => setActiveConversation(conv.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-dark-950">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-dark-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-dark-400" />
                </div>
                <div>
                  <div className="font-medium">
                    {activeConversation.participants.find(p => p !== currentUserId)?.slice(0, 12) ?? 'Unknown'}...
                  </div>
                  <div className="flex items-center gap-2">
                    <SecurityBadge type="encrypted" small />
                    {activeConversation.keyExchangeComplete && (
                      <SecurityBadge type="pfs" small />
                    )}
                  </div>
                </div>
              </div>
              <button className="btn-ghost p-2" aria-label="Settings" title="Settings">
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <MessageList 
              messages={conversationMessages}
              currentUserId={currentUserId}
            />

            {/* Message Input */}
            <MessageInput conversationId={activeConversation.id} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ShieldIcon className="w-16 h-16 text-dark-700 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-dark-400 mb-2">
                Select a conversation
              </h2>
              <p className="text-dark-500 text-sm max-w-xs">
                Choose a conversation from the sidebar or create a new invitation to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ 
  conversation, 
  isActive, 
  onClick 
}: { 
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg text-left transition-colors ${
        isActive 
          ? 'bg-phantom-900/30 border border-phantom-700/50' 
          : 'hover:bg-dark-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-5 h-5 text-dark-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">
              {conversation.participants[0]?.slice(0, 8)}...
            </span>
            {conversation.lastMessageAt && (
              <span className="text-xs text-dark-500">
                {formatTimestamp(conversation.lastMessageAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <SecurityBadge type="encrypted" small />
            {conversation.unreadCount > 0 && (
              <span className="bg-phantom-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageList({ 
  messages, 
  currentUserId 
}: { 
  messages: Message[];
  currentUserId: string;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ShieldIcon className="w-12 h-12 text-dark-700 mx-auto mb-3" />
          <p className="text-dark-400">
            Messages are end-to-end encrypted
          </p>
          <p className="text-dark-500 text-sm mt-1">
            Start the conversation by sending a message
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.senderId === currentUserId}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const isBurned = message.status === 'burned';
  const media = message.metadata?.media;
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const identity = useIdentityStore((state) => state.identity);

  const handleDownload = useCallback(async () => {
    if (!media || !identity) return;
    
    setDownloading(true);
    try {
      const result = await mediaService.downloadMedia(
        media.mediaId,
        identity.identityKeyPair.secretKey,
        media.encryptedKey,
        media.iv
      );
      
      if (result.success && result.data) {
        const url = mediaService.createBlobUrl(result.data, media.mimeType);
        setMediaUrl(url);
        
        // Auto-download for non-image/video types
        if (media.type === 'file' || media.type === 'audio') {
          mediaService.downloadToDevice(result.data, media.name, media.mimeType);
        }
      }
    } catch (error) {
      console.error('Failed to download media:', error);
    } finally {
      setDownloading(false);
    }
  }, [media, identity]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (mediaUrl) {
        mediaService.revokeBlobUrl(mediaUrl);
      }
    };
  }, [mediaUrl]);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isBurned
            ? 'bg-dark-800/50 border border-dark-700'
            : isOwn
            ? 'bg-phantom-600 text-white'
            : 'bg-dark-800 text-dark-100'
        }`}
      >
        {isBurned ? (
          <div className="flex items-center gap-2 text-dark-400 italic">
            <FireIcon className="w-4 h-4" />
            <span>Message burned</span>
          </div>
        ) : (
          <>
            {/* Media attachment */}
            {media && (
              <div className="mb-2">
                {mediaUrl ? (
                  media.type === 'image' ? (
                    <img 
                      src={mediaUrl} 
                      alt={media.name}
                      className="max-w-full rounded-lg cursor-pointer"
                      onClick={() => window.open(mediaUrl, '_blank')}
                    />
                  ) : media.type === 'video' ? (
                    <video 
                      src={mediaUrl} 
                      controls
                      className="max-w-full rounded-lg"
                    />
                  ) : media.type === 'audio' ? (
                    <audio src={mediaUrl} controls className="w-full" />
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-dark-700/50 rounded-lg">
                      <PaperclipIcon className="w-5 h-5" />
                      <span className="truncate flex-1">{media.name}</span>
                      <span className="text-xs text-dark-400">Downloaded</span>
                    </div>
                  )
                ) : (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`flex items-center gap-2 p-3 rounded-lg w-full ${
                      isOwn ? 'bg-phantom-700/50' : 'bg-dark-700/50'
                    } hover:opacity-80 transition-opacity`}
                  >
                    {media.type === 'image' ? (
                      <ImageIcon className="w-5 h-5" />
                    ) : (
                      <PaperclipIcon className="w-5 h-5" />
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate text-sm">{media.name}</div>
                      <div className="text-xs opacity-70">
                        {formatFileSize(media.size)}
                      </div>
                    </div>
                    {downloading ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <DownloadIcon className="w-5 h-5" />
                    )}
                  </button>
                )}
              </div>
            )}
            
            {/* Text content */}
            {message.content && <p className="break-words">{message.content}</p>}
            
            <div className={`flex items-center gap-2 mt-1 text-xs ${
              isOwn ? 'text-phantom-200' : 'text-dark-400'
            }`}>
              <span>{formatTimestamp(message.timestamp)}</span>
              {message.burnAfterRead && (
                <FireIcon className="w-3 h-3 text-orange-400" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageInput({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState('');
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const identity = useIdentityStore((state) => state.identity);
  const sessionKeys = useConversationsStore((state) => state.sessionKeys);
  const conversations = useConversationsStore((state) => state.conversations);
  const addMessage = useMessagesStore((state) => state.addMessage);

  const currentUserId = identity?.id 
    ? new TextDecoder().decode(identity.id) 
    : '';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = mediaService.validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setError(null);
    setAttachment(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachmentPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!message.trim() && !attachment) return;
    if (!identity) {
      setError('Identity not initialized');
      return;
    }

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      setError('Conversation not found');
      return;
    }

    const keys = sessionKeys.get(conversationId);
    if (!keys) {
      setError('Session keys not established');
      return;
    }

    // Get recipient's public key (the other participant)
    const recipientId = conversation.participants.find(p => p !== currentUserId);
    if (!recipientId) {
      setError('Recipient not found');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let mediaInfo: MediaInfo | undefined;

      // Upload attachment if present
      if (attachment) {
        setUploadProgress(10);
        
        // Read file as bytes
        const fileBuffer = await attachment.arrayBuffer();
        const fileData = new Uint8Array(fileBuffer);
        
        setUploadProgress(30);
        
        // Upload encrypted media
        const uploadResult = await mediaService.uploadMedia(
          fileData,
          base64ToBytes(recipientId), // Recipient's public key (stored as base64 ID)
          attachment.name,
          attachment.type
        );

        if (!uploadResult.success || !uploadResult.mediaId) {
          throw new Error(uploadResult.error || 'Failed to upload media');
        }

        setUploadProgress(70);

        // Create media info for message metadata
        mediaInfo = {
          mediaId: uploadResult.mediaId,
          name: attachment.name,
          size: attachment.size,
          mimeType: attachment.type,
          type: mediaService.getMediaType(attachment.type),
          encryptedKey: uploadResult.encryptedKey || '',
          iv: uploadResult.iv || ''
        };
      }

      setUploadProgress(80);

      // Create the message
      const messageId = generateRequestId();
      const timestamp = Date.now();
      const content = message.trim();

      // Encrypt message content
      const recipientPublicKey = base64ToBytes(recipientId);
      const encryptResult = await encryptMessage(
        content || (mediaInfo ? `[${mediaInfo.type}]` : ''),
        keys,
        identity,
        recipientPublicKey
      );

      if (!encryptResult.success || !encryptResult.data) {
        throw new Error(encryptResult.error || 'Failed to encrypt message');
      }

      // Send via WebSocket
      await wsClient.sendRequest('message', {
        to: recipientId,
        encryptedContent: encryptResult.data,
        burnAfterRead,
        mediaInfo: mediaInfo ? {
          mediaId: mediaInfo.mediaId,
          name: mediaInfo.name,
          size: mediaInfo.size,
          mimeType: mediaInfo.mimeType,
          type: mediaInfo.type
        } : undefined
      });

      setUploadProgress(100);

      // Add to local store
      const newMessage: Message = {
        id: messageId,
        conversationId,
        senderId: currentUserId,
        content,
        timestamp,
        type: 'text',
        status: 'sent',
        burnAfterRead,
        ...(mediaInfo && { metadata: { media: mediaInfo } })
      };

      addMessage(conversationId, newMessage);

      // Clear inputs
      setMessage('');
      clearAttachment();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-dark-800">
      {/* Error message */}
      {error && (
        <div className="mb-2 p-2 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="mb-3 p-3 bg-dark-800 rounded-lg">
          <div className="flex items-center gap-3">
            {attachmentPreview ? (
              <img 
                src={attachmentPreview} 
                alt="Preview" 
                className="w-16 h-16 object-cover rounded-lg"
              />
            ) : (
              <div className="w-16 h-16 bg-dark-700 rounded-lg flex items-center justify-center">
                <PaperclipIcon className="w-6 h-6 text-dark-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{attachment.name}</div>
              <div className="text-sm text-dark-400">
                {formatFileSize(attachment.size)}
              </div>
              {uploading && (
                <div className="mt-1 h-1 bg-dark-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-phantom-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            <button 
              onClick={clearAttachment}
              className="btn-ghost p-2 text-dark-400 hover:text-dark-200"
              disabled={uploading}
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Burn after read toggle */}
        <button
          onClick={() => setBurnAfterRead(!burnAfterRead)}
          className={`btn-ghost p-2 ${burnAfterRead ? 'text-orange-400' : 'text-dark-400'}`}
          title={burnAfterRead ? 'Burn after reading enabled' : 'Enable burn after reading'}
        >
          <FireIcon className="w-5 h-5" />
        </button>

        {/* File attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-ghost p-2 text-dark-400 hover:text-dark-200"
          title="Attach file"
          disabled={uploading}
        >
          <PaperclipIcon className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.txt,.zip"
        />
        
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="input resize-none pr-12"
            disabled={uploading}
          />
          <button
            onClick={handleSend}
            disabled={(!message.trim() && !attachment) || uploading}
            className="absolute right-2 bottom-2 btn-primary p-2 disabled:opacity-50"
            aria-label="Send message"
            title="Send message"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {burnAfterRead && (
        <div className="mt-2 text-xs text-orange-400 flex items-center gap-1">
          <FireIcon className="w-3 h-3" />
          Message will be deleted after reading
        </div>
      )}
    </div>
  );
}

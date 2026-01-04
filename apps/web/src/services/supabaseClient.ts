/**
 * Phantom Messenger - Supabase Client
 * 
 * Client-side Supabase instance for authentication
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables. Auth will not work.');
}

export const supabase = createClient(
    supabaseUrl || 'http://localhost:54321',
    supabaseAnonKey || 'placeholder-key'
);

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: (email.split('@')[0] ?? 'user').toLowerCase()
            }
        }
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        // If user doesn't exist, try to sign up
        if (error.message === 'Invalid login credentials') {
            return signUp(email, password);
        }
        throw new Error(error.message);
    }

    return data;
}

/**
 * Sign out current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw new Error(error.message);
    }
}

/**
 * Get current session
 */
export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw new Error(error.message);
    }
    return data.session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        return null;
    }
    return data.user;
}

/**
 * Update user's public key in profile
 */
export async function updatePublicKey(publicKey: string) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('profiles')
        .update({ public_key: publicKey })
        .eq('id', user.id);

    if (error) {
        console.error('[Supabase] Failed to update public key:', error);
        // Don't throw - this is not critical for the app to function
    }
}

/**
 * Get user profile by username
 */
export async function getProfileByUsername(username: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

    if (error) {
        return null;
    }
    return data;
}

// =========================================
// INVITATION FUNCTIONS
// =========================================

export interface Invitation {
    id: string;
    code: string;
    creator_id: string;
    creator_public_key: string;
    expires_at: string;
    used_by: string | null;
    used_at: string | null;
    created_at: string;
}

export interface Connection {
    id: string;
    user_a: string;
    user_b: string;
    established_at: string;
}

export interface Profile {
    id: string;
    username: string;
    public_key: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Store a new invitation in the database
 */
export async function storeInvitation(
    code: string,
    creatorPublicKey: string,
    expiresAt: Date
): Promise<Invitation | null> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
        .from('invitations')
        .insert({
            code,
            creator_id: user.id,
            creator_public_key: creatorPublicKey,
            expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[Supabase] Failed to store invitation:', error);
        throw new Error(error.message);
    }

    return data;
}

/**
 * Get invitation by code
 */
export async function getInvitation(code: string): Promise<Invitation | null> {
    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('code', code)
        .single();

    if (error) {
        return null;
    }
    return data;
}

/**
 * Accept an invitation - marks invitation as used and creates connection
 */
export async function acceptInvitation(code: string): Promise<{
    success: boolean;
    error?: string;
    creatorProfile?: Profile;
}> {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    console.log('[Accept] Current user ID:', user.id);
    console.log('[Accept] Current user email:', user.email);

    // Get the invitation
    const invitation = await getInvitation(code);
    if (!invitation) {
        return { success: false, error: 'Invalid invitation code' };
    }

    console.log('[Accept] Invitation creator_id:', invitation.creator_id);
    console.log('[Accept] Are they equal?', invitation.creator_id === user.id);

    // Check if already used
    if (invitation.used_by) {
        return { success: false, error: 'Invitation already used' };
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
        return { success: false, error: 'Invitation expired' };
    }

    // Check if user is trying to accept their own invitation
    if (invitation.creator_id === user.id) {
        return { success: false, error: 'Cannot accept your own invitation' };
    }

    // Mark invitation as used
    console.log('[Accept] Attempting to update invitation:', invitation.id);
    const { error: updateError } = await supabase
        .from('invitations')
        .update({
            used_by: user.id,
            used_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

    if (updateError) {
        console.error('[Accept] Failed to update invitation:', updateError);
        return { success: false, error: `Failed to accept invitation: ${updateError.message}` };
    }
    console.log('[Accept] Invitation updated successfully');

    // Create connection (ensure consistent ordering of user IDs)
    const [userA, userB] = [user.id, invitation.creator_id].sort();

    const { error: connectionError } = await supabase
        .from('connections')
        .insert({
            user_a: userA,
            user_b: userB
        });

    if (connectionError && !connectionError.message.includes('duplicate')) {
        console.error('[Supabase] Failed to create connection:', connectionError);
        // Don't fail - invitation was accepted, connection might already exist
    }

    // Get creator's profile
    const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', invitation.creator_id)
        .single();

    return {
        success: true,
        creatorProfile: creatorProfile || undefined
    };
}

/**
 * Get all connections for current user
 */
export async function getConnections(): Promise<Connection[]> {
    const user = await getCurrentUser();
    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('connections')
        .select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (error) {
        console.error('[Supabase] Failed to get connections:', error);
        return [];
    }

    return data || [];
}

/**
 * Get profiles of connected users
 */
export async function getConnectionProfiles(): Promise<Profile[]> {
    const user = await getCurrentUser();
    if (!user) {
        return [];
    }

    const connections = await getConnections();
    if (connections.length === 0) {
        return [];
    }

    // Get the other user's ID from each connection
    const otherUserIds = connections.map(c =>
        c.user_a === user.id ? c.user_b : c.user_a
    );

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherUserIds);

    if (error) {
        console.error('[Supabase] Failed to get connection profiles:', error);
        return [];
    }

    return data || [];
}

/**
 * Get my invitations (pending ones)
 */
export async function getMyInvitations(): Promise<Invitation[]> {
    const user = await getCurrentUser();
    if (!user) {
        return [];
    }

    const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('creator_id', user.id)
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Supabase] Failed to get invitations:', error);
        return [];
    }

    return data || [];
}


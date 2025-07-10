import { ensureUserAuthenticated } from './supabase';

export function generateUserId(): string {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export async function getUserId(): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  try {
    // Use Supabase auth to get or create user
    return await ensureUserAuthenticated();
  } catch (error) {
    console.error('Failed to get user ID:', error);
    // Fallback to localStorage-based ID
    let userId = localStorage.getItem('podcast_user_id');
    if (!userId) {
      userId = generateUserId();
      localStorage.setItem('podcast_user_id', userId);
    }
    return userId;
  }
}

export function setUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('podcast_user_id', userId);
}

export async function ensureUserExists(userId: string): Promise<void> {
  // This function is no longer needed as authentication handles user creation
  // Keep it for backward compatibility
  return;
}
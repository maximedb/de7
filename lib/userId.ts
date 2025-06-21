export function generateUserId(): string {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  
  let userId = localStorage.getItem('podcast_user_id');
  
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem('podcast_user_id', userId);
  }
  
  return userId;
}

export function setUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('podcast_user_id', userId);
}
/**
 * AyosPH - Supabase Configuration
 * Core database and authentication setup
 */

// Supabase configuration
const SUPABASE_URL = 'https://krwrooshyeriyydmwcax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyd3Jvb3NoeWVyaXl5ZG13Y2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzE5NTUsImV4cCI6MjA5NDIwNzk1NX0.1s4Bpm4aya4n-58q4XQTDLXUnElf4FKWjt9Fk3I5qvE';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// Storage buckets
const STORAGE_BUCKETS = {
    REPORT_IMAGES: 'report-images',
    USER_AVATARS: 'user-avatars'
};

// Table names
const TABLES = {
    USERS: 'users',
    REPORTS: 'reports',
    COMMENTS: 'comments',
    NOTIFICATIONS: 'notifications'
};

// Export for use in other modules
window.AyosPHConfig = {
    supabase,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    STORAGE_BUCKETS,
    TABLES
};

console.log('AyosPH Supabase initialized');

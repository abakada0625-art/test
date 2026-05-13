/**
 * AyosPH - Supabase Configuration
 * Core database and authentication setup
 */

// Supabase configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

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

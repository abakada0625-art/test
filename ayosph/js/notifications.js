/**
 * AyosPH - Notifications Module
 * Handles user notifications and real-time updates
 */

class NotificationsManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.channel = null;
    }

    /**
     * Initialize notifications
     */
    async init() {
        if (!Auth.isAuthenticated()) return;

        await this.fetchNotifications();
        this.subscribeToUpdates();
        this.updateBadge();
    }

    /**
     * Fetch user notifications
     */
    async fetchNotifications() {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) return;

            const { data, error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            this.notifications = data || [];
            this.unreadCount = this.notifications.filter(n => !n.is_read).length;
            
            return { success: true, data: this.notifications };
        } catch (error) {
            console.error('Fetch notifications error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Subscribe to realtime notification updates
     */
    subscribeToUpdates() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return;

        this.channel = window.AyosPHConfig.supabase
            .channel('notifications-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: window.AyosPHConfig.TABLES.NOTIFICATIONS,
                    filter: `user_id=eq.${currentUser.id}`
                },
                (payload) => {
                    this.handleNewNotification(payload.new);
                }
            )
            .subscribe();
    }

    /**
     * Handle new notification
     */
    handleNewNotification(notification) {
        this.notifications.unshift(notification);
        if (!notification.is_read) {
            this.unreadCount++;
        }
        this.updateBadge();
        this.showNotificationToast(notification);
        this.renderNotifications();
    }

    /**
     * Show notification toast
     */
    showNotificationToast(notification) {
        Utils.showToast('info', notification.title, notification.message);
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        try {
            const { error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;

            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification && !notification.is_read) {
                notification.is_read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateBadge();
            }

            return { success: true };
        } catch (error) {
            console.error('Mark as read error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) return;

            const { error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .eq('is_read', false);

            if (error) throw error;

            this.notifications.forEach(n => n.is_read = true);
            this.unreadCount = 0;
            this.updateBadge();
            this.renderNotifications();

            return { success: true };
        } catch (error) {
            console.error('Mark all as read error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update notification badge
     */
    updateBadge() {
        const badge = document.querySelector('.notification-dot');
        const countEl = document.querySelector('.notification-count');
        
        if (badge) {
            badge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }
        
        if (countEl) {
            countEl.textContent = this.unreadCount;
            countEl.style.display = this.unreadCount > 0 ? 'inline' : 'none';
        }
    }

    /**
     * Render notifications dropdown
     */
    renderNotifications() {
        const container = document.querySelector('.notifications-dropdown');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="dropdown-menu">
                    <div class="dropdown-item" style="justify-content: center; color: var(--gray-500);">
                        No notifications
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="dropdown-menu">
                <div class="dropdown-header" style="padding: var(--spacing-md); border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600;">Notifications</span>
                    ${this.unreadCount > 0 ? 
                        `<button onclick="Notifications.markAllAsRead()" style="font-size: 0.75rem; color: var(--primary-600);">Mark all read</button>` 
                        : ''}
                </div>
                ${this.notifications.slice(0, 10).map(notification => `
                    <a href="${notification.link_url || '#'}" class="dropdown-item" style="${!notification.is_read ? 'background: var(--primary-50);' : ''}" onclick="Notifications.markAsRead('${notification.id}')">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; margin-bottom: 2px;">${Utils.truncateText(notification.title, 50)}</div>
                            <div style="font-size: 0.8125rem; color: var(--gray-500);">${Utils.formatRelativeTime(notification.created_at)}</div>
                        </div>
                        ${!notification.is_read ? '<span style="width: 8px; height: 8px; background: var(--primary-500); border-radius: 50%;"></span>' : ''}
                    </a>
                `).join('')}
                <div style="padding: var(--spacing-md); text-align: center; border-top: 1px solid var(--gray-100);">
                    <a href="/notifications.html" style="font-size: 0.875rem; color: var(--primary-600); font-weight: 500;">View all</a>
                </div>
            </div>
        `;
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId) {
        try {
            const { error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .delete()
                .eq('id', notificationId);

            if (error) throw error;

            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            if (!this.notifications.find(n => n.id === notificationId)?.is_read) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
            this.updateBadge();
            this.renderNotifications();

            return { success: true };
        } catch (error) {
            console.error('Delete notification error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear all notifications
     */
    async clearAll() {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) return;

            const { error } = await window.AyosPHConfig.supabase
                .from(window.AyosPHConfig.TABLES.NOTIFICATIONS)
                .delete()
                .eq('user_id', currentUser.id);

            if (error) throw error;

            this.notifications = [];
            this.unreadCount = 0;
            this.updateBadge();
            this.renderNotifications();

            return { success: true };
        } catch (error) {
            console.error('Clear all error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Unsubscribe from realtime updates
     */
    unsubscribe() {
        if (this.channel) {
            window.AyosPHConfig.supabase.removeChannel(this.channel);
        }
    }
}

// Initialize global notifications manager
const Notifications = new NotificationsManager();
window.Notifications = Notifications;

console.log('AyosPH Notifications module initialized');

/**
 * AyosPH - Admin Module
 * Barangay officials admin dashboard functionality
 */

class AdminManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.reports = [];
        this.stats = {};
        this.chartInstance = null;
    }

    async init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/login.html';
            return;
        }
        this.currentUser = Auth.getCurrentUser();
        this.userProfile = Auth.getUserProfile();
        if (!Auth.isAdmin()) {
            Utils.showToast('error', 'Access Denied', 'You do not have admin privileges');
            window.location.href = '/dashboard.html';
            return;
        }
        Notifications.init();
        await this.loadStats();
        await this.loadReports();
        await this.setupEventListeners();
        await this.renderUserMenu();
        await this.renderCharts();
        Reports.subscribeToUpdates(() => {
            this.handleReportUpdate();
        });
        console.log('Admin dashboard initialized');
    }

    async loadStats() {
        const result = await Reports.getStatistics();
        if (result.success) {
            this.stats = result.data;
            this.renderStats();
        }
    }

    renderStats() {
        document.getElementById('stat-total').textContent = this.stats.total || 0;
        document.getElementById('stat-pending').textContent = this.stats.byStatus?.['Pending'] || 0;
        document.getElementById('stat-fixed').textContent = this.stats.byStatus?.['Fixed'] || 0;
        document.getElementById('stat-in-progress').textContent = this.stats.byStatus?.['In Progress'] || 0;
        document.getElementById('stat-emergency').textContent = this.stats.bySeverity?.['Emergency'] || 0;
    }

    async loadReports(filters = {}) {
        const result = await Reports.fetchReports(filters);
        if (result.success) {
            this.reports = result.data;
            this.renderReportsTable();
        }
    }

    renderReportsTable() {
        const tbody = document.querySelector('#reports-table tbody');
        if (!tbody) return;
        if (this.reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-500);">No reports found</td></tr>';
            return;
        }
        tbody.innerHTML = this.reports.map(report => `
            <tr>
                <td data-label="Report">
                    <div class="cell-with-icon">
                        ${report.image_before ? `<img src="${report.image_before}" alt="" class="cell-image">` : '<div class="cell-placeholder"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>'}
                        <div><div class="cell-title">${Utils.truncateText(report.title, 30)}</div><div class="cell-subtitle">${Utils.formatRelativeTime(report.created_at)}</div></div>
                    </div>
                </td>
                <td data-label="Category"><span class="badge" style="background:var(--primary-50);color:var(--primary-700);">${report.category}</span></td>
                <td data-label="Severity"><span class="badge ${Utils.getSeverityBadgeClass(report.severity)}">${report.severity}</span></td>
                <td data-label="Status"><span class="badge ${Utils.getStatusBadgeClass(report.status)}">${report.status}</span></td>
                <td data-label="Reporter"><div>${report.users?.full_name || 'Unknown'}</div><div class="cell-subtitle">${Utils.truncateText(report.location, 25)}</div></td>
                <td data-label="Date">${Utils.formatDate(report.created_at, {month:'short',day:'numeric',year:'numeric'})}</td>
                <td data-label="Actions">
                    <div class="action-buttons">
                        <button class="btn-action view" onclick="Admin.viewReport('${report.id}')" title="View"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
                        <button class="btn-action edit" onclick="Admin.updateReportStatus('${report.id}')" title="Update Status"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                        <button class="btn-action delete" onclick="Admin.deleteReport('${report.id}')" title="Delete"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async viewReport(reportId) {
        const result = await Reports.getReportById(reportId);
        if (!result.success) return;
        const report = result.data;
        const modal = document.getElementById('report-detail-modal');
        modal.innerHTML = `
            <div class="modal" style="max-width:800px;">
                <div class="modal-header">
                    <h3 class="modal-title">Report Details</h3>
                    <button class="modal-close" onclick="Utils.hideModal('report-detail-modal')"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
                <div class="modal-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-lg);margin-bottom:var(--spacing-xl);">
                        ${report.image_before ? `<div><h4 style="margin-bottom:var(--spacing-sm);">Before</h4><img src="${report.image_before}" style="width:100%;border-radius:var(--radius-lg);"></div>` : ''}
                        ${report.image_after ? `<div><h4 style="margin-bottom:var(--spacing-sm);">After</h4><img src="${report.image_after}" style="width:100%;border-radius:var(--radius-lg);"></div>` : ''}
                    </div>
                    <div style="margin-bottom:var(--spacing-lg);"><h4>Title</h4><p>${report.title}</p></div>
                    <div style="margin-bottom:var(--spacing-lg);"><h4>Description</h4><p>${report.description}</p></div>
                    <div style="margin-bottom:var(--spacing-lg);"><h4>Location</h4><p>${report.location}</p></div>
                    <div style="margin-bottom:var(--spacing-lg);"><h4>Status</h4><span class="badge ${Utils.getStatusBadgeClass(report.status)}">${report.status}</span></div>
                    <div style="margin-bottom:var(--spacing-lg);"><h4>Severity</h4><span class="badge ${Utils.getSeverityBadgeClass(report.severity)}">${report.severity}</span></div>
                    ${report.remarks ? `<div style="margin-bottom:var(--spacing-lg);"><h4>Remarks</h4><p>${report.remarks}</p></div>` : ''}
                    <div class="comments-section"><h4>Comments</h4><div id="comments-list">${await this.renderComments(report.id)}</div></div>
                </div>
            </div>
        `;
        Utils.showModal('report-detail-modal');
    }

    async renderComments(reportId) {
        const result = await Reports.getComments(reportId);
        if (!result.success || result.data.length === 0) return '<p style="color:var(--gray-500);text-align:center;padding:var(--spacing-lg);">No comments yet</p>';
        return result.data.map(c => `<div class="comment-item"><div class="comment-avatar">${Utils.getInitials(c.users?.full_name)}</div><div class="comment-content"><div class="comment-header"><span class="comment-author">${c.users?.full_name||'Unknown'}</span><span class="comment-date">${Utils.formatRelativeTime(c.created_at)}</span></div><p class="comment-text">${c.message}</p></div></div>`).join('');
    }

    async updateReportStatus(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) return;
        const modal = document.getElementById('update-status-modal');
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Update Report Status</h3>
                    <button class="modal-close" onclick="Utils.hideModal('update-status-modal')"><svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
                <div class="modal-body">
                    <form id="status-update-form">
                        <input type="hidden" value="${reportId}" id="update-report-id">
                        <div class="form-group">
                            <label class="form-label">Select Status</label>
                            <div class="status-options">
                                ${Reports.statuses.map(s => `<div class="status-option ${s===report.status?'selected':''}" data-status="${s}" onclick="Admin.selectStatus(this)"><div class="status-option-icon"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div><div class="status-option-name">${s}</div></div>`).join('')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Remarks</label>
                            <textarea class="form-textarea" id="update-remarks" placeholder="Add remarks...">${report.remarks||''}</textarea>
                        </div>
                        <div class="proof-upload-section" id="proof-upload-section" style="display:none;">
                            <h4 class="proof-upload-title">Proof of Fix (Required)</h4>
                            <div class="file-upload">
                                <input type="file" class="file-upload-input" id="proof-image" accept="image/*">
                                <div class="file-upload-icon"><svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
                                <div class="file-upload-text">Drop image or click to upload</div>
                            </div>
                            <div id="proof-preview"></div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="Utils.hideModal('update-status-modal')">Cancel</button>
                    <button class="btn btn-primary" onclick="Admin.submitStatusUpdate()">Update Status</button>
                </div>
            </div>
        `;
        Utils.showModal('update-status-modal');
        this.checkProofRequirement(report.status);
    }

    selectStatus(el) {
        document.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        this.checkProofRequirement(el.dataset.status);
    }

    checkProofRequirement(status) {
        const section = document.getElementById('proof-upload-section');
        if (section) section.style.display = status === 'Fixed' ? 'block' : 'none';
    }

    async submitStatusUpdate() {
        const reportId = document.getElementById('update-report-id').value;
        const selected = document.querySelector('.status-option.selected');
        const remarks = document.getElementById('update-remarks').value;
        const proofInput = document.getElementById('proof-image');
        if (!selected) { Utils.showToast('error', 'Validation Error', 'Please select a status'); return; }
        const status = selected.dataset.status;
        if (status === 'Fixed' && (!proofInput?.files?.length)) { Utils.showToast('error', 'Validation Error', 'Please upload proof of fix'); return; }
        const result = await Reports.updateReportStatus(reportId, status, remarks, proofInput?.files?.[0] || null);
        if (result.success) { Utils.hideModal('update-status-modal'); await this.loadReports(); await this.loadStats(); }
    }

    async deleteReport(reportId) {
        if (!confirm('Are you sure you want to delete this report?')) return;
        const result = await Reports.deleteReport(reportId);
        if (result.success) { await this.loadReports(); await this.loadStats(); }
    }

    async renderCharts() {
        const ctx = document.getElementById('category-chart');
        if (!ctx) return;
        if (this.chartInstance) this.chartInstance.destroy();
        const stats = this.stats;
        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: Object.keys(stats.byCategory||{}), datasets: [{ data: Object.values(stats.byCategory||{}), backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#6b7280'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } } } }
        });
    }

    async handleReportUpdate() { await this.loadReports(); await this.loadStats(); await this.renderCharts(); }

    async renderUserMenu() {
        const av = document.getElementById('user-avatar'), un = document.getElementById('user-name');
        const avSm = document.getElementById('user-avatar-sm');
        if (av) av.textContent = Utils.getInitials(this.userProfile?.full_name);
        if (un) un.textContent = this.userProfile?.full_name || 'User';
        if (avSm) avSm.textContent = Utils.getInitials(this.userProfile?.full_name);
    }

    async setupEventListeners() {
        const menuToggle = document.querySelector('.menu-toggle'), sidebar = document.querySelector('.sidebar');
        if (menuToggle && sidebar) menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.addEventListener('input', Utils.debounce(async e => await this.loadReports({search:e.target.value.trim()}), 300));
        const filter = document.getElementById('status-filter');
        if (filter) filter.addEventListener('change', async e => await this.loadReports({status: e.target.value !== 'all' ? e.target.value : null}));
        const logoutBtn = document.querySelector('[data-action="logout"]');
        if (logoutBtn) logoutBtn.addEventListener('click', async () => await Auth.logout());
        const exportBtn = document.querySelector('[data-action="export"]');
        if (exportBtn) exportBtn.addEventListener('click', () => Reports.exportToCSV(this.reports));
        const proofInput = document.getElementById('proof-image');
        if (proofInput) proofInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) { const reader = new FileReader(); reader.onload = ev => document.getElementById('proof-preview').innerHTML = `<div class="file-preview" style="margin-top:var(--spacing-md);"><img src="${ev.target.result}"></div>`; reader.readAsDataURL(file); }
        });
    }
}

const Admin = new AdminManager();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Admin.init());
else Admin.init();
console.log('AyosPH Admin module loaded');

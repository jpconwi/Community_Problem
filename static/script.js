// Global variables
let currentUser = null;
let stream = null;
let photoData = null;
let authCheckTimeout;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting auth check...');
    
    // Set a timeout to ensure loading screen doesn't stay forever
    authCheckTimeout = setTimeout(() => {
        console.log('Auth check timeout reached, forcing login screen');
        hideLoading();
        showScreen('login-screen');
    }, 5000); // 5 second timeout
    
    checkAuthStatus();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Report form - FIXED: Add proper event listener
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleReportSubmit(e);
        });
    }
}

// Browser Notification Functions
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return false;
    }
    
    if (Notification.permission === "granted") {
        console.log("Notification permission already granted");
        return true;
    }
    
    if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Notification permission granted");
                showSnackbar('Notifications enabled! You will receive updates.');
            }
        });
    }
    
    return false;
}

function showBrowserNotification(title, message, icon = null) {
    if (Notification.permission !== "granted") {
        requestNotificationPermission();
        return;
    }
    
    const options = {
        body: message,
        icon: icon || '/static/favicon.ico',
        badge: '/static/favicon.ico',
        tag: 'communitycare-update',
        requireInteraction: true,
        actions: [
            {
                action: 'view',
                title: 'View'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    const notification = new Notification(title, options);
    
    notification.onclick = function() {
        window.focus();
        notification.close();
        // Navigate to relevant section based on user role
        if (currentUser && currentUser.role === 'admin') {
            showScreen('admin-dashboard');
            loadAllReports();
        } else {
            showMyReports();
        }
    };
    
    notification.onclose = function() {
        console.log('Notification closed');
    };
    
    // Auto-close after 10 seconds
    setTimeout(() => {
        notification.close();
    }, 10000);
    
    return notification;
}

// Periodic check for updates
function setupPeriodicUpdateCheck() {
    if (!currentUser) return;
    
    // Check every 30 seconds for updates
    setInterval(async () => {
        try {
            await checkForUpdates();
        } catch (error) {
            console.error('Periodic update check failed:', error);
        }
    }, 30000); // 30 seconds
}

// Check for new reports, status updates, etc.
async function checkForUpdates() {
    if (!currentUser) return;
    
    try {
        if (currentUser.role === 'admin') {
            await checkAdminUpdates();
        } else {
            await checkUserUpdates();
        }
    } catch (error) {
        console.error('Update check failed:', error);
    }
}

// Check updates for regular users
async function checkUserUpdates() {
    const lastCheck = localStorage.getItem('lastUpdateCheck') || Date.now();
    
    try {
        // Check for new notifications
        const notificationsResponse = await fetch('/api/notifications_count');
        const notificationsData = await notificationsResponse.json();
        
        // Check for report status updates
        const reportsResponse = await fetch('/api/user_reports');
        const reportsData = await reportsResponse.json();
        
        if (reportsData.success) {
            const storedReports = JSON.parse(localStorage.getItem('userReports') || '[]');
            const newResolvedReports = reportsData.reports.filter(newReport => {
                const oldReport = storedReports.find(r => r.id === newReport.id);
                return newReport.status === 'Resolved' && 
                       (!oldReport || oldReport.status !== 'Resolved');
            });
            
            if (newResolvedReports.length > 0) {
                newResolvedReports.forEach(report => {
                    showBrowserNotification(
                        'Report Resolved!',
                        `Your report "${report.problem_type}" has been resolved. Click to view details.`,
                        '/static/favicon.ico'
                    );
                });
            }
            
            // Store current reports for next comparison
            localStorage.setItem('userReports', JSON.stringify(reportsData.reports));
        }
        
        localStorage.setItem('lastUpdateCheck', Date.now());
    } catch (error) {
        console.error('User update check failed:', error);
    }
}

// Check updates for admin users
async function checkAdminUpdates() {
    const lastCheck = localStorage.getItem('lastAdminUpdateCheck') || Date.now();
    
    try {
        // Check for new reports
        const newReportsResponse = await fetch('/api/new_reports_count');
        const newReportsData = await newReportsResponse.json();
        
        if (newReportsData.success && newReportsData.count > 0) {
            const lastNewReportCount = parseInt(localStorage.getItem('lastNewReportCount') || '0');
            
            if (newReportsData.count > lastNewReportCount) {
                const newCount = newReportsData.count - lastNewReportCount;
                showBrowserNotification(
                    'New Reports Submitted',
                    `${newCount} new report${newCount > 1 ? 's' : ''} waiting for review. Click to view.`,
                    '/static/favicon.ico'
                );
            }
            
            localStorage.setItem('lastNewReportCount', newReportsData.count);
        }
        
        localStorage.setItem('lastAdminUpdateCheck', Date.now());
    } catch (error) {
        console.error('Admin update check failed:', error);
    }
}

// Real-time notification for immediate updates
function setupRealTimeNotifications() {
    if (!currentUser) return;
    
    // Listen for custom events (you can trigger these from your backend)
    document.addEventListener('newReportSubmitted', (event) => {
        if (currentUser.role === 'admin') {
            showBrowserNotification(
                'New Report Submitted',
                `A new ${event.detail.problemType} report has been submitted.`,
                '/static/favicon.ico'
            );
        }
    });
    
    document.addEventListener('reportStatusUpdated', (event) => {
        if (currentUser.role === 'user' && event.detail.userId === currentUser.id) {
            showBrowserNotification(
                'Report Status Updated',
                `Your report "${event.detail.problemType}" is now ${event.detail.status}.`,
                '/static/favicon.ico'
            );
        }
    });
}

// Handle status changes in admin dashboard
function handleStatusChange(selectElement, reportId) {
    const newStatus = selectElement.value;
    console.log(`🔄 Status change for report ${reportId}: ${newStatus}`);
    
    if (newStatus === 'Resolved') {
        showResolutionModal(reportId, selectElement);
    } else {
        // For other status changes, update immediately
        updateStatus(reportId, newStatus);
    }
}

// Update status for non-resolved changes
async function updateStatus(reportId, newStatus) {
    try {
        console.log(`📤 Updating report ${reportId} to status: ${newStatus}`);
        const response = await fetch('/api/update_report_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: reportId,
                status: newStatus
            })
        });
        
        const data = await response.json();
        console.log('Status update response:', data);
        
        if (data.success) {
            showSnackbar('Status updated successfully!');
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Failed to update status:', error);
        showSnackbar('Failed to update status', 'error');
    }
}

// Resolution modal functions
function showResolutionModal(reportId, selectElement) {
    console.log(`📝 Showing resolution modal for report ${reportId}`);
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('resolution-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'resolution-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Resolution Details</h3>
                    <button class="close-btn" onclick="cancelResolution()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Please provide details on how this issue was resolved:</p>
                    
                    <div class="form-group">
                        <i class="fas fa-user-check"></i>
                        <input type="text" id="auditor-name" placeholder="Enter your name (auditor)" required>
                    </div>
                    
                    <div class="form-group">
                        <i class="fas fa-file-lines"></i>
                        <textarea id="resolution-notes" placeholder="Describe the resolution steps, materials used, or any other relevant details..." rows="4" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; resize: vertical;" required></textarea>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="cancelResolution()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" id="confirm-resolution-btn">
                        Submit Resolution
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Store the current select element and report ID
    modal.dataset.reportId = reportId;
    modal.dataset.selectElement = selectElement.id;
    
    // Clear previous inputs
    document.getElementById('auditor-name').value = '';
    document.getElementById('resolution-notes').value = '';
    
    // Show modal
    modal.classList.remove('hidden');
    document.getElementById('auditor-name').focus();
    
    // Add event listener for the resolution modal button (remove previous ones first)
    const confirmBtn = document.getElementById('confirm-resolution-btn');
    confirmBtn.onclick = submitResolution;
}

function cancelResolution() {
    console.log('❌ Resolution cancelled');
    const modal = document.getElementById('resolution-modal');
    const selectElement = document.getElementById(modal.dataset.selectElement);
    
    // Reset to previous value (In Progress)
    if (selectElement) {
        selectElement.value = 'In Progress';
    }
    
    modal.classList.add('hidden');
    document.getElementById('auditor-name').value = '';
    document.getElementById('resolution-notes').value = '';
}

async function submitResolution() {
    const modal = document.getElementById('resolution-modal');
    const reportId = modal.dataset.reportId;
    const auditorName = document.getElementById('auditor-name').value;
    const resolutionNotes = document.getElementById('resolution-notes').value;
    
    console.log(`📤 Submitting resolution for report ${reportId}:`, { auditorName, resolutionNotes });
    
    if (!auditorName.trim()) {
        showSnackbar('Please enter your name as auditor', 'error');
        document.getElementById('auditor-name').focus();
        return;
    }
    
    if (!resolutionNotes.trim()) {
        showSnackbar('Please provide resolution details', 'error');
        document.getElementById('resolution-notes').focus();
        return;
    }
    
    try {
        const response = await fetch('/api/update_report_with_resolution', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: parseInt(reportId),
                status: 'Resolved',
                auditor_name: auditorName,
                resolution_notes: resolutionNotes
            })
        });
        
        const data = await response.json();
        console.log('Resolution submission response:', data);
        
        if (data.success) {
            showSnackbar('Report resolved successfully!');
            modal.classList.add('hidden');
            document.getElementById('auditor-name').value = '';
            document.getElementById('resolution-notes').value = '';
            await loadAdminStats();
            await loadAllReports();
        } else {
            showSnackbar(data.message, 'error');
            // Reset the select element if failed
            const selectElement = document.getElementById(modal.dataset.selectElement);
            if (selectElement) {
                selectElement.value = 'In Progress';
            }
        }
    } catch (error) {
        console.error('Resolution error:', error);
        showSnackbar('Failed to update report', 'error');
        // Reset the select element if error
        const selectElement = document.getElementById(modal.dataset.selectElement);
        if (selectElement) {
            selectElement.value = 'In Progress';
        }
    }
}

// Notification functions for admin dashboard
async function checkNewReportsNotification() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/new_reports_count');
        const data = await response.json();
        
        if (data.success && data.count > 0) {
            showNewReportsNotification(data.count);
        }
    } catch (error) {
        console.error('Failed to check new reports:', error);
    }
}

// Function to show new reports notification
function showNewReportsNotification(count) {
    // Remove existing notification if any
    const existingNotification = document.getElementById('new-reports-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'new-reports-notification';
    notification.innerHTML = `
        <div class="new-reports-alert">
            <div class="alert-content">
                <i class="fas fa-bell"></i>
                <div class="alert-text">
                    <strong>${count} new report${count > 1 ? 's' : ''} submitted!</strong>
                    <span>Click to view</span>
                </div>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    // Add click handler to load reports
    notification.addEventListener('click', function() {
        loadAllReports();
        this.remove();
    });
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// Load admin notifications count for the bell
async function loadAdminNotificationsCount() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/new_reports_count');
        const data = await response.json();
        
        const badge = document.getElementById('admin-notification-badge');
        if (data.success && data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load admin notifications count:', error);
    }
}

// Show admin notifications
function showAdminNotifications() {
    // Create a modal or dropdown for admin notifications
    showAdminNotificationsModal();
}

// Admin notifications modal
function showAdminNotificationsModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('admin-notifications-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-notifications-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Admin Notifications</h3>
                    <button class="close-btn" onclick="document.getElementById('admin-notifications-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="admin-notifications-list" class="notifications-list">
                        <!-- Notifications will be loaded here -->
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('admin-notifications-modal').classList.add('hidden')">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    loadAdminNotifications();
    modal.classList.remove('hidden');
}

// Load admin notifications
async function loadAdminNotifications() {
    try {
        const response = await fetch('/api/new_reports_count');
        const data = await response.json();
        
        const notificationsList = document.getElementById('admin-notifications-list');
        
        if (data.success && data.count > 0) {
            // Get detailed new reports info
            const reportsResponse = await fetch('/api/all_reports');
            const reportsData = await reportsResponse.json();
            
            if (reportsData.success) {
                const yesterday = new Date();
                yesterday.setHours(yesterday.getHours() - 24);
                
                const newReports = reportsData.reports.filter(report => {
                    const reportDate = new Date(report.date);
                    return reportDate >= yesterday;
                });
                
                notificationsList.innerHTML = `
                    <div class="notification-header">
                        <i class="fas fa-bell" style="color: #667eea;"></i>
                        <span><strong>${data.count} new report${data.count > 1 ? 's' : ''} in last 24 hours</strong></span>
                    </div>
                    <div class="new-reports-list">
                        ${newReports.map(report => `
                            <div class="new-report-item">
                                <div class="report-type-badge">${report.problem_type}</div>
                                <div class="report-details">
                                    <strong>${report.location}</strong>
                                    <span>By: ${report.username}</span>
                                    <small>${report.date}</small>
                                </div>
                                <div class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                                    ${report.status}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-bell-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No new reports</p>
                    <small>All caught up!</small>
                </div>
            `;
        }
        
        // Update badge count
        await loadAdminNotificationsCount();
    } catch (error) {
        console.error('Failed to load admin notifications:', error);
        const notificationsList = document.getElementById('admin-notifications-list');
        notificationsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Failed to load notifications</p>
            </div>
        `;
    }
}

// Update the loadAdminDashboard function to include notification bell
async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const adminContainer = document.querySelector('.admin-container');
    adminContainer.innerHTML = `
        <div class="screen-header">
            <h2>Admin Dashboard</h2>
            <div class="admin-header-actions">
                <button class="icon-btn" onclick="showAdminNotifications()">
                    <i class="fas fa-bell"></i>
                    <span id="admin-notification-badge" class="badge hidden">0</span>
                </button>
                <button class="btn btn-outline" onclick="checkNewReportsNotification()" title="Check for new reports">
                    <i class="fas fa-sync-alt"></i>
                    Refresh
                </button>
                <button class="btn btn-danger" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        </div>
        
        <!-- Notification Status -->
        <div id="admin-notification-status" class="notification-status hidden">
            <!-- New reports notification will appear here -->
        </div>
        
        <!-- Filter Controls -->
        <div class="card">
            <h3>Filter Reports</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                <button class="btn btn-outline" onclick="filterReports('today')" style="flex: 1; min-width: 80px;">
                    <i class="fas fa-calendar-day"></i> Today
                </button>
                <button class="btn btn-outline" onclick="filterReports('week')" style="flex: 1; min-width: 80px;">
                    <i class="fas fa-calendar-week"></i> This Week
                </button>
                <button class="btn btn-outline" onclick="filterReports('month')" style="flex: 1; min-width: 80px;">
                    <i class="fas fa-calendar-alt"></i> This Month
                </button>
                <button class="btn btn-outline" onclick="filterReports('all')" style="flex: 1; min-width: 80px;">
                    <i class="fas fa-calendar"></i> All Time
                </button>
            </div>
            <div id="filter-indicator" style="text-align: center; color: #64748b; font-size: 14px; padding: 10px;">
                Showing: All Time
            </div>
        </div>
        
        <div class="admin-stats" id="admin-stats">
            <!-- Stats will be loaded here -->
        </div>
        
        <div class="card">
            <h3>Reports</h3>
            <div id="admin-reports-list">
                <!-- Reports will be loaded here -->
            </div>
        </div>
    `;
    
    await loadAdminStats();
    await loadAllReports();
    await checkNewReportsNotification(); // Check for new reports when dashboard loads
    await loadAdminNotificationsCount(); // Load notification count for the bell
}

// Setup periodic checking for new reports (admin only)
function setupPeriodicReportCheck() {
    if (currentUser && currentUser.role === 'admin') {
        // Check every 30 seconds
        setInterval(async () => {
            try {
                const response = await fetch('/api/new_reports_count');
                const data = await response.json();
                
                if (data.success && data.count > 0) {
                    showNewReportsNotification(data.count);
                    await loadAdminNotificationsCount(); // Update badge count
                }
            } catch (error) {
                console.error('Periodic report check failed:', error);
            }
        }, 30000); // 30 seconds
    }
}

// Update the checkAuthStatus function to setup periodic checking for admins
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch('/api/user_info');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Auth response:', data);
        
        // Clear the timeout since we got a response
        clearTimeout(authCheckTimeout);
        
        if (data.success) {
            currentUser = data.user;
            
            // Request notification permission and setup notifications
            requestNotificationPermission();
            setupPeriodicUpdateCheck();
            setupRealTimeNotifications();
            
            if (currentUser.role === 'admin') {
                showScreen('admin-dashboard');
                loadAdminDashboard();
                setupPeriodicReportCheck();
            } else {
                showScreen('user-dashboard');
                loadUserDashboard();
            }
        } else {
            console.log('Not logged in, showing login screen');
            showScreen('login-screen');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Clear the timeout on error too
        clearTimeout(authCheckTimeout);
        showScreen('login-screen');
    } finally {
        hideLoading();
    }
}

// Filter reports by time period
async function filterReports(period) {
    try {
        console.log(`🔍 Filtering reports for: ${period}`);
        const response = await fetch('/api/all_reports');
        const data = await response.json();
        
        if (data.success && data.reports.length > 0) {
            const now = new Date();
            let filteredReports = [];
            
            switch(period) {
                case 'today':
                    filteredReports = data.reports.filter(report => {
                        const reportDate = new Date(report.date);
                        return reportDate.toDateString() === now.toDateString();
                    });
                    break;
                    
                case 'week':
                    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    filteredReports = data.reports.filter(report => {
                        const reportDate = new Date(report.date);
                        return reportDate >= oneWeekAgo;
                    });
                    break;
                    
                case 'month':
                    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    filteredReports = data.reports.filter(report => {
                        const reportDate = new Date(report.date);
                        return reportDate >= oneMonthAgo;
                    });
                    break;
                    
                case 'all':
                default:
                    filteredReports = data.reports;
                    break;
            }
            
            displayFilteredReports(filteredReports, period);
            updateFilterStats(filteredReports);
        } else {
            document.getElementById('admin-reports-list').innerHTML = `
                <div style="text-align: center; padding: 20px; color: #64748b;">
                    <p>No reports found</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to filter reports:', error);
        showSnackbar('Failed to filter reports', 'error');
    }
}

// Display filtered reports with audit information
function displayFilteredReports(reports, period) {
    const reportsList = document.getElementById('admin-reports-list');
    
    if (reports.length > 0) {
        reportsList.innerHTML = reports.map(report => {
            // Check if report is from last 24 hours
            const reportDate = new Date(report.date);
            const now = new Date();
            const isNewReport = (now - reportDate) <= (24 * 60 * 60 * 1000);
            
            return `
                <div class="report-card ${isNewReport ? 'new-report-highlight' : ''}">
                    ${isNewReport ? `
                        <div style="position: absolute; top: 10px; right: 10px;">
                            <span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;">
                                <i class="fas fa-star" style="margin-right: 4px;"></i>NEW
                            </span>
                        </div>
                    ` : ''}
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span>By: ${report.username}</span>
                        <span>${report.date}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="report-photo">
                            <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
                        </div>
                    ` : ''}
                    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <select class="status-select" data-report-id="${report.id}" style="flex: 2; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; min-width: 120px;" onchange="handleStatusChange(this, ${report.id})">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)" style="padding: 8px 12px; flex: 1;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;">
                                <strong style="color: #1e40af; font-size: 14px;">Resolution Details</strong>
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                    ${report.auditor_name ? `
                                        <span style="color: #64748b; font-size: 12px; font-style: italic;">
                                            <i class="fas fa-user-check"></i> Audited by: ${report.auditor_name}
                                        </span>
                                    ` : ''}
                                    ${report.resolved_at ? `
                                        <span style="color: #64748b; font-size: 12px; font-style: italic;">
                                            <i class="fas fa-clock"></i> Resolved: ${report.resolved_at}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            ${report.resolution_notes ? `
                                <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">No resolution details provided.</p>
                            `}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Update filter indicator
        const filterIndicator = document.getElementById('filter-indicator');
        if (filterIndicator) {
            const periodText = period === 'today' ? 'Today' : 
                             period === 'week' ? 'This Week' : 
                             period === 'month' ? 'This Month' : 'All Time';
            filterIndicator.textContent = `Showing: ${periodText} (${reports.length} reports)`;
        }
    } else {
        const periodText = period === 'today' ? 'today' : 
                         period === 'week' ? 'this week' : 
                         period === 'month' ? 'this month' : 'all time';
        reportsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                <i class="fas fa-file-alt" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>No reports found for ${periodText}</p>
            </div>
        `;
    }
}

// Show detailed audit information
function showAuditInfo(report) {
    const modal = document.getElementById('audit-info-modal');
    
    // Populate audit information
    document.getElementById('audit-report-id').textContent = report.id || '-';
    document.getElementById('audit-submitter').textContent = report.username || 'Unknown';
    document.getElementById('audit-submitted-date').textContent = report.date || '-';
    document.getElementById('audit-resolver').textContent = report.resolved_by || 'Not resolved';
    document.getElementById('audit-auditor').textContent = report.auditor_name || 'Not audited';
    document.getElementById('audit-resolved-date').textContent = report.resolved_at || 'Not resolved';
    document.getElementById('audit-resolution-notes').textContent = report.resolution_notes || 'No resolution notes provided';
    
    modal.classList.remove('hidden');
}

// Enhanced delete with modal confirmation
function showDeleteConfirmation(reportId, isAdmin = false) {
    const modal = document.getElementById('delete-confirmation-modal');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    
    // Set up the confirmation button
    confirmBtn.onclick = function() {
        deleteReport(reportId, isAdmin);
        modal.classList.add('hidden');
    };
    
    modal.classList.remove('hidden');
}

// Update stats for filtered reports
function updateFilterStats(reports) {
    const total = reports.length;
    const pending = reports.filter(r => r.status === 'Pending').length;
    const inProgress = reports.filter(r => r.status === 'In Progress').length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    
    const statsContainer = document.getElementById('admin-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="admin-stat-card">
                <div class="admin-stat-value">${total}</div>
                <div class="admin-stat-label">Total Reports</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-value">${pending}</div>
                <div class="admin-stat-label">Pending</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-value">${inProgress}</div>
                <div class="admin-stat-label">In Progress</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-value">${resolved}</div>
                <div class="admin-stat-label">Resolved</div>
            </div>
        `;
    }
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    console.log('Login form submitted');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showSnackbar('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showSnackbar('Logging in...');
        console.log(`Attempting login for: ${email}`);
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            currentUser = data.user;
            console.log(`Login successful! User role: ${currentUser.role}`);
            
            // Request notification permission and setup notifications
            requestNotificationPermission();
            setupPeriodicUpdateCheck();
            setupRealTimeNotifications();
            
            if (currentUser.role === 'admin') {
                console.log('Redirecting to admin dashboard...');
                showScreen('admin-dashboard');
                await loadAdminDashboard();
            } else {
                console.log('Redirecting to user dashboard...');
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            showSnackbar('Login successful!');
        } else {
            console.error('Login failed:', data.message);
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showSnackbar('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('Register form submitted');
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !email || !password || !confirmPassword) {
        showSnackbar('Please fill in all required fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showSnackbar('Passwords do not match', 'error');
        return;
    }
    
    try {
        showSnackbar('Creating account...');
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                email,
                phone,
                password,
                confirm_password: confirmPassword
            })
        });
        
        const data = await response.json();
        console.log('Register response:', data);
        
        if (data.success) {
            showSnackbar('Account created successfully!');
            showScreen('login-screen');
            // Clear form
            document.getElementById('register-form').reset();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showSnackbar('Registration failed. Please try again.', 'error');
    }
}

async function logout() {
    try {
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            photoData = null;
            showScreen('login-screen');
            showSnackbar('Logged out successfully!');
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Dashboard functions
async function loadUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name').textContent = currentUser.username;
    await loadStats();
    await loadNotificationsCount();
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('user-reports-count').textContent = stats.my_reports;
            document.getElementById('user-pending-count').textContent = stats.pending;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadNotificationsCount() {
    try {
        const response = await fetch('/api/notifications_count');
        const data = await response.json();
        
        const badge = document.getElementById('notification-badge');
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load notifications count:', error);
    }
}

// Report functions
async function handleReportSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showSnackbar('Please login first!', 'error');
        return;
    }
    
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    const priority = document.getElementById('priority').value;
    
    if (!problemType || !location || !issue) {
        showSnackbar('Please fill in all required fields!', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/submit_report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                problem_type: problemType,
                location: location,
                issue: issue,
                priority: priority,
                photo_data: photoData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report submitted successfully!');
            document.getElementById('report-form').reset();
            removePhoto();
            await loadStats();
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        showSnackbar('Failed to submit report. Please try again.', 'error');
    }
}

// Photo functions
function openCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-view');
    
    modal.classList.remove('hidden');
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(mediaStream) {
            stream = mediaStream;
            video.srcObject = stream;
        })
        .catch(function(error) {
            console.error('Camera error:', error);
            showSnackbar('Failed to access camera', 'error');
            closeCamera();
        });
}

function closeCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-view');
    
    modal.classList.add('hidden');
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    video.srcObject = null;
}

function capturePhoto() {
    const video = document.getElementById('camera-view');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    photoData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Show preview
    const preview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');
    
    previewImage.src = photoData;
    preview.classList.remove('hidden');
    
    closeCamera();
    showSnackbar('Photo captured successfully!');
}

function handleFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showSnackbar('Please select a valid image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        photoData = e.target.result;
        
        // Show preview
        const preview = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        
        previewImage.src = photoData;
        preview.classList.remove('hidden');
        
        showSnackbar('Photo uploaded successfully!');
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    photoData = null;
    document.getElementById('photo-preview').classList.add('hidden');
}

// Navigation functions
function showScreen(screenId) {
    console.log(`Switching to screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log(`Screen ${screenId} is now active`);
    } else {
        console.error(`Screen ${screenId} not found!`);
    }
}

function showMyReports() {
    showScreen('my-reports-screen');
    loadMyReports();
}

// Updated loadMyReports function with complete audit information
async function loadMyReports() {
    try {
        const response = await fetch('/api/user_reports');
        const data = await response.json();
        
        const reportsList = document.getElementById('reports-list');
        
        if (data.success && data.reports.length > 0) {
            reportsList.innerHTML = data.reports.map(report => `
                <div class="report-card">
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span>${report.date}</span>
                        <span>${report.priority}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="report-photo">
                            <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
                        </div>
                    ` : ''}
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #10b981;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;">
                                <div>
                                    <div style="display: flex; align-items: center; margin-bottom: 4px;">
                                        <i class="fas fa-check-circle" style="color: #10b981; margin-right: 8px;"></i>
                                        <strong style="color: #047857; font-size: 14px;">
                                            Report Resolved
                                        </strong>
                                    </div>
                                    ${report.auditor_name ? `
                                        <div style="display: flex; align-items: center;">
                                            <i class="fas fa-user-check" style="color: #2563eb; margin-right: 8px;"></i>
                                            <span style="color: #374151; font-size: 13px;">
                                                Audited by: ${report.auditor_name}
                                            </span>
                                        </div>
                                    ` : ''}
                                </div>
                                ${report.resolved_at ? `
                                    <div style="display: flex; align-items: center; color: #64748b; font-size: 12px;">
                                        <i class="fas fa-clock" style="margin-right: 4px;"></i>
                                        ${report.resolved_at}
                                    </div>
                                ` : ''}
                            </div>
                            ${report.resolution_notes ? `
                                <div style="margin-top: 8px; padding: 10px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                                    <strong style="color: #047857; font-size: 13px; display: block; margin-bottom: 4px;">Resolution Notes:</strong>
                                    <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                                </div>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-style: italic;">
                                    No additional resolution details provided.
                                </p>
                            `}
                        </div>
                    ` : ''}
                    <div class="report-actions" style="margin-top: 12px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, false)" style="padding: 8px 12px; font-size: 12px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-file-alt" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No reports yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

function showNotifications() {
    showScreen('notifications-screen');
    loadNotifications();
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        const notificationsList = document.getElementById('notifications-list');
        
        if (data.success && data.notifications.length > 0) {
            notificationsList.innerHTML = data.notifications.map(notification => `
                <div class="notification-card">
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${notification.created_at}</div>
                </div>
            `).join('');
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                    <i class="fas fa-bell-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No notifications</p>
                </div>
            `;
        }
        
        // Update badge
        await loadNotificationsCount();
    } catch (error) {
        console.error('Failed to load notifications:', error);
        showSnackbar('Failed to load notifications', 'error');
    }
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            const statsContainer = document.getElementById('admin-stats');
            
            statsContainer.innerHTML = `
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.total}</div>
                    <div class="admin-stat-label">Total Reports</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.pending}</div>
                    <div class="admin-stat-label">Pending</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.in_progress}</div>
                    <div class="admin-stat-label">In Progress</div>
                </div>
                <div class="admin-stat-card">
                    <div class="admin-stat-value">${stats.resolved}</div>
                    <div class="admin-stat-label">Resolved</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

// Complete loadAllReports function
async function loadAllReports() {
    try {
        const response = await fetch('/api/all_reports');
        const data = await response.json();
        
        const reportsList = document.getElementById('admin-reports-list');
        
        if (data.success && data.reports.length > 0) {
            // Set initial filter indicator
            const filterIndicator = document.getElementById('filter-indicator');
            if (filterIndicator) {
                filterIndicator.textContent = `Showing: All Time (${data.reports.length} reports)`;
            }
            
            reportsList.innerHTML = data.reports.map(report => `
                <div class="report-card">
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span>By: ${report.username}</span>
                        <span>${report.date}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="report-photo">
                            <img src="${report.photo_data}" alt="Report photo" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
                        </div>
                    ` : ''}
                    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <select class="status-select" data-report-id="${report.id}" style="flex: 2; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; min-width: 120px;" onchange="handleStatusChange(this, ${report.id})">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)" style="padding: 8px 12px; flex: 1;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 10px; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;">
                                <strong style="color: #1e40af; font-size: 14px;">Resolution Details</strong>
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                    ${report.auditor_name ? `
                                        <span style="color: #64748b; font-size: 12px; font-style: italic;">
                                            <i class="fas fa-user-check"></i> Audited by: ${report.auditor_name}
                                        </span>
                                    ` : ''}
                                    ${report.resolved_at ? `
                                        <span style="color: #64748b; font-size: 12px; font-style: italic;">
                                            <i class="fas fa-clock"></i> Resolved: ${report.resolved_at}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            ${report.resolution_notes ? `
                                <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">No resolution details provided.</p>
                            `}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #64748b;">
                    <p>No reports found</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load all reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

// Delete report functions
async function deleteReport(reportId, isAdmin = false) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        return;
    }
    
    try {
        const endpoint = isAdmin ? '/api/delete_report' : '/api/delete_user_report';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                report_id: reportId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSnackbar('Report deleted successfully!');
            // Reload the appropriate list
            if (isAdmin) {
                await loadAllReports();
                await loadAdminStats();
            } else {
                await loadMyReports();
                await loadStats();
            }
        } else {
            showSnackbar(data.message, 'error');
        }
    } catch (error) {
        console.error('Delete report error:', error);
        showSnackbar('Failed to delete report', 'error');
    }
}

// Utility functions
function showSnackbar(message, type = 'success') {
    // Create snackbar if it doesn't exist
    let snackbar = document.getElementById('snackbar');
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'snackbar';
        snackbar.className = 'snackbar hidden';
        document.body.appendChild(snackbar);
    }
    
    snackbar.textContent = message;
    snackbar.className = `snackbar ${type}`;
    snackbar.classList.remove('hidden');
    
    setTimeout(() => {
        snackbar.classList.add('hidden');
    }, 3000);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('active');
        console.log('Loading screen hidden');
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Dropdown functionality
function toggleDropdown() {
    const dropdown = document.getElementById('account-dropdown');
    const dropdownBtn = document.querySelector('.dropdown-btn');
    
    // Close all other dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu !== dropdown) {
            menu.classList.add('hidden');
        }
    });
    
    // Toggle current dropdown
    dropdown.classList.toggle('hidden');
    dropdownBtn.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    const dropdownBtns = document.querySelectorAll('.dropdown-btn');
    
    let isClickInsideDropdown = false;
    
    dropdowns.forEach(dropdown => {
        if (dropdown.contains(event.target)) {
            isClickInsideDropdown = true;
        }
    });
    
    dropdownBtns.forEach(btn => {
        if (btn.contains(event.target)) {
            isClickInsideDropdown = true;
        }
    });
    
    if (!isClickInsideDropdown) {
        dropdowns.forEach(dropdown => {
            dropdown.classList.add('hidden');
        });
        dropdownBtns.forEach(btn => {
            btn.classList.remove('active');
        });
    }
});

// Close dropdown when a menu item is clicked
function closeDropdown() {
    const dropdown = document.getElementById('account-dropdown');
    const dropdownBtn = document.querySelector('.dropdown-btn');
    
    dropdown.classList.add('hidden');
    dropdownBtn.classList.remove('active');
}

// Update the logout function to close dropdown
async function logout() {
    try {
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            photoData = null;
            closeDropdown(); // Close dropdown before navigating
            showScreen('login-screen');
            showSnackbar('Logged out successfully!');
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Update showMyReports to close dropdown
function showMyReports() {
    closeDropdown(); // Close dropdown before navigating
    showScreen('my-reports-screen');
    loadMyReports();
}


// Global variables
let currentUser = null;
let stream = null;
let photoData = null;
let authCheckTimeout;
let notifications = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌐 BAYAN System Initializing...');
    
    // Set a timeout to ensure loading screen doesn't stay forever
    authCheckTimeout = setTimeout(() => {
        console.log('⏰ Auth check timeout reached, forcing login screen');
        hideLoading();
        showScreen('login-screen');
    }, 5000);
    
    checkAuthStatus();
    setupEventListeners();
    createSnowflakes();
    
    // Add service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('✅ ServiceWorker registration successful with scope:', registration.scope);
        }).catch(function(error) {
            console.log('❌ ServiceWorker registration failed:', error);
        });
    }
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
    
    // Report form
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleReportSubmit(e);
        });
    }
    
    // Setup dropdown click handlers
    setupDropdownHandlers();
    
    // Setup file upload
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                handleFileUpload(this.files[0]);
            }
        });
    }
    
    // Setup offline/online detection
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// Handle online status
function handleOnline() {
    console.log('🌐 Online - Syncing data...');
    showSnackbar('You are back online!', 'success');
    if (currentUser) {
        checkAuthStatus();
    }
}

// Handle offline status
function handleOffline() {
    console.log('📴 Offline - Working in offline mode');
    showSnackbar('You are offline. Some features may be limited.', 'warning');
}

// Setup dropdown handlers
function setupDropdownHandlers() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        // User dropdown
        const userDropdown = document.getElementById('user-dropdown');
        const userMenuBtn = document.querySelector('.dashboard-container .three-dot-menu');
        
        if (userDropdown && userMenuBtn) {
            const isClickInsideDropdown = userDropdown.contains(event.target);
            const isClickOnMenuBtn = userMenuBtn.contains(event.target);
            
            if (!isClickInsideDropdown && !isClickOnMenuBtn && !userDropdown.classList.contains('hidden')) {
                userDropdown.classList.add('hidden');
                const icon = userMenuBtn.querySelector('i');
                icon.style.transform = 'rotate(0deg)';
            }
        }
        
        // Admin dropdown
        const adminDropdown = document.getElementById('admin-dropdown-menu');
        const adminMenuBtn = document.querySelector('.admin-container .three-dot-menu');
        
        if (adminDropdown && adminMenuBtn) {
            const isClickInsideAdminDropdown = adminDropdown.contains(event.target);
            const isClickOnAdminMenuBtn = adminMenuBtn.contains(event.target);
            
            if (!isClickInsideAdminDropdown && !isClickOnAdminMenuBtn && !adminDropdown.classList.contains('hidden')) {
                adminDropdown.classList.add('hidden');
                const icon = adminMenuBtn.querySelector('i');
                icon.style.transform = 'rotate(0deg)';
            }
        }
    });
    
    // Prevent dropdown close when clicking inside dropdown
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
}

// Enhanced Report functions
async function handleReportSubmit(e) {
    e.preventDefault();
    
    console.log('📋 Report form submitted - Starting validation');
    
    if (!currentUser) {
        showSnackbar('Please login first!', 'error');
        return;
    }
    
    // Get form values
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    const priority = document.getElementById('priority').value;
    
    console.log('📋 Form data:', { problemType, location, issue, priority });
    
    // Validate form
    if (!validateReportForm()) {
        return;
    }
    
    try {
        // Show loading state
        const submitBtn = document.getElementById('submit-report-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;
        
        console.log('📤 Submitting report to server...');
        
        // Simulate API call (replace with actual API)
        setTimeout(async () => {
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
                console.log('✅ Submit response:', data);
                
                if (data.success) {
                    showSnackbar('🎉 Report submitted successfully!', 'success');
                    // Add notification
                    addNotification('Report Submitted', `Your ${problemType} report has been submitted and is now pending review.`);
                    
                    // Reset form
                    document.getElementById('report-form').reset();
                    removePhoto();
                    
                    // Refresh stats
                    await loadStats();
                    console.log('🔄 Stats refreshed after report submission');
                    
                    // Show animation
                    showSuccessAnimation();
                } else {
                    console.error('❌ Report submission failed:', data.message);
                    showSnackbar(`❌ ${data.message || 'Failed to submit report'}`, 'error');
                }
            } catch (error) {
                console.error('💥 Report submission error:', error);
                showSnackbar('❌ Failed to submit report. Please try again.', 'error');
            } finally {
                // Reset button state
                const submitBtn = document.getElementById('submit-report-btn');
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
                    submitBtn.disabled = false;
                }
            }
        }, 1000);
        
    } catch (error) {
        console.error('💥 Report submission error:', error);
        showSnackbar('❌ Failed to submit report. Please try again.', 'error');
    }
}

// Form validation
function validateReportForm() {
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    
    if (!problemType) {
        showSnackbar('Please select a problem type', 'error');
        document.getElementById('problem-type').focus();
        return false;
    }
    
    if (!location.trim()) {
        showSnackbar('Please enter a location', 'error');
        document.getElementById('location').focus();
        return false;
    }
    
    if (location.trim().length < 5) {
        showSnackbar('Please provide a more specific location', 'error');
        document.getElementById('location').focus();
        return false;
    }
    
    if (!issue.trim()) {
        showSnackbar('Please describe the issue', 'error');
        document.getElementById('issue').focus();
        return false;
    }
    
    if (issue.trim().length < 10) {
        showSnackbar('Please provide more details about the issue (minimum 10 characters)', 'error');
        document.getElementById('issue').focus();
        return false;
    }
    
    return true;
}

// Show success animation
function showSuccessAnimation() {
    const successDiv = document.createElement('div');
    successDiv.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(37, 99, 235, 0.9); display: flex; align-items: center; justify-content: center; z-index: 3000; animation: fadeIn 0.5s ease;">
            <div style="text-align: center; color: white; padding: 40px;">
                <i class="fas fa-check-circle" style="font-size: 80px; margin-bottom: 20px; animation: scaleUp 0.5s ease;"></i>
                <h2 style="font-size: 32px; margin-bottom: 10px;">Report Submitted!</h2>
                <p style="font-size: 18px; opacity: 0.9;">Thank you for contributing to our community</p>
            </div>
        </div>
    `;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 2000);
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
                console.log("✅ Notification permission granted");
                showSnackbar('🔔 Notifications enabled! You will receive updates.', 'success');
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
        tag: 'bayan-update',
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
    }, 30000);
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
                        '🎉 Report Resolved!',
                        `Your report "${report.problem_type}" has been resolved.`,
                        '/static/favicon.ico'
                    );
                    addNotification('Report Resolved', `Your ${report.problem_type} report has been successfully resolved.`);
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
                    '📢 New Reports Submitted',
                    `${newCount} new report${newCount > 1 ? 's' : ''} waiting for review.`,
                    '/static/favicon.ico'
                );
                addNotification('New Reports', `${newCount} new report${newCount > 1 ? 's' : ''} submitted and awaiting review.`);
            }
            
            localStorage.setItem('lastNewReportCount', newReportsData.count);
        }
        
        localStorage.setItem('lastAdminUpdateCheck', Date.now());
    } catch (error) {
        console.error('Admin update check failed:', error);
    }
}

// Add notification to list
function addNotification(title, message) {
    const notification = {
        id: Date.now(),
        title: title,
        message: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString(),
        read: false
    };
    
    notifications.unshift(notification);
    
    // Update notification badge
    updateNotificationBadge();
    
    // Store in localStorage
    localStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 50))); // Keep last 50
}

// Update notification badge
function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notification-badge');
    const adminBadge = document.getElementById('admin-notification-badge');
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    if (adminBadge) {
        if (unreadCount > 0) {
            adminBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            adminBadge.classList.remove('hidden');
        } else {
            adminBadge.classList.add('hidden');
        }
    }
}

// Real-time notification for immediate updates
function setupRealTimeNotifications() {
    if (!currentUser) return;
    
    // Listen for custom events (you can trigger these from your backend)
    document.addEventListener('newReportSubmitted', (event) => {
        if (currentUser.role === 'admin') {
            showBrowserNotification(
                '📢 New Report Submitted',
                `A new ${event.detail.problemType} report has been submitted.`,
                '/static/favicon.ico'
            );
        }
    });
    
    document.addEventListener('reportStatusUpdated', (event) => {
        if (currentUser.role === 'user' && event.detail.userId === currentUser.id) {
            showBrowserNotification(
                '🔄 Report Status Updated',
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
        
        // Show loading on select
        const selectElement = document.querySelector(`select[data-report-id="${reportId}"]`);
        const originalValue = selectElement.value;
        selectElement.disabled = true;
        
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
            showSnackbar('✅ Status updated successfully!', 'success');
            await loadAdminStats();
            await loadAllReports();
            
            // Add notification
            addNotification('Status Updated', `Report #${reportId} status changed to ${newStatus}`);
        } else {
            showSnackbar(`❌ ${data.message}`, 'error');
            selectElement.value = originalValue;
        }
    } catch (error) {
        console.error('Failed to update status:', error);
        showSnackbar('❌ Failed to update status', 'error');
    } finally {
        const selectElement = document.querySelector(`select[data-report-id="${reportId}"]`);
        if (selectElement) {
            selectElement.disabled = false;
        }
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
                    <h3><i class="fas fa-check-circle"></i> Resolution Details</h3>
                    <button class="close-btn" onclick="cancelResolution()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 20px; color: var(--text-secondary);">Please provide details on how this issue was resolved:</p>
                    
                    <div class="form-group">
                        <i class="fas fa-user-check"></i>
                        <input type="text" id="auditor-name" placeholder="Enter your name (auditor)" required>
                    </div>
                    
                    <div class="form-group">
                        <i class="fas fa-file-lines"></i>
                        <textarea id="resolution-notes" placeholder="Describe the resolution steps, materials used, or any other relevant details..." rows="4" required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <i class="fas fa-clock"></i>
                        <input type="date" id="resolution-date" required>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="cancelResolution()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button type="button" class="btn btn-primary" id="confirm-resolution-btn">
                        <i class="fas fa-check"></i> Submit Resolution
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Set default date to today
        document.getElementById('resolution-date').valueAsDate = new Date();
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
}

async function submitResolution() {
    const modal = document.getElementById('resolution-modal');
    const reportId = modal.dataset.reportId;
    const auditorName = document.getElementById('auditor-name').value;
    const resolutionNotes = document.getElementById('resolution-notes').value;
    const resolutionDate = document.getElementById('resolution-date').value;
    
    console.log(`📤 Submitting resolution for report ${reportId}:`, { auditorName, resolutionNotes, resolutionDate });
    
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
                resolution_notes: resolutionNotes,
                resolution_date: resolutionDate
            })
        });
        
        const data = await response.json();
        console.log('Resolution submission response:', data);
        
        if (data.success) {
            showSnackbar('✅ Report resolved successfully!', 'success');
            modal.classList.add('hidden');
            
            // Add notification
            addNotification('Report Resolved', `Report #${reportId} has been resolved by ${auditorName}`);
            
            await loadAdminStats();
            await loadAllReports();
            
            // Show success animation
            const resolvedDiv = document.createElement('div');
            resolvedDiv.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(22, 163, 74, 0.9); display: flex; align-items: center; justify-content: center; z-index: 3000; animation: fadeIn 0.5s ease;">
                    <div style="text-align: center; color: white; padding: 40px;">
                        <i class="fas fa-check-circle" style="font-size: 80px; margin-bottom: 20px; animation: scaleUp 0.5s ease;"></i>
                        <h2 style="font-size: 32px; margin-bottom: 10px;">Report Resolved!</h2>
                        <p style="font-size: 18px; opacity: 0.9;">Great work! The issue has been addressed.</p>
                    </div>
                </div>
            `;
            document.body.appendChild(resolvedDiv);
            
            setTimeout(() => {
                resolvedDiv.remove();
            }, 2000);
        } else {
            showSnackbar(`❌ ${data.message}`, 'error');
            // Reset the select element if failed
            const selectElement = document.getElementById(modal.dataset.selectElement);
            if (selectElement) {
                selectElement.value = 'In Progress';
            }
        }
    } catch (error) {
        console.error('Resolution error:', error);
        showSnackbar('❌ Failed to update report', 'error');
        // Reset the select element if error
        const selectElement = document.getElementById(modal.dataset.selectElement);
        if (selectElement) {
            selectElement.value = 'In Progress';
        }
    }
}

// Authentication functions
async function checkAuthStatus() {
    try {
        console.log('🔐 Checking auth status...');
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
            
            // Load notifications from localStorage
            const storedNotifications = localStorage.getItem('notifications');
            if (storedNotifications) {
                notifications = JSON.parse(storedNotifications);
            }
            
            // Request notification permission and setup notifications
            requestNotificationPermission();
            setupPeriodicUpdateCheck();
            setupRealTimeNotifications();
            
            if (currentUser.role === 'admin') {
                showScreen('admin-dashboard');
                await loadAdminDashboard();
                setupPeriodicReportCheck();
            } else {
                showScreen('user-dashboard');
                await loadUserDashboard();
            }
            
            // Update notification badge
            updateNotificationBadge();
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

async function handleLogin(e) {
    e.preventDefault();
    console.log('🔐 Login form submitted');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showSnackbar('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showSnackbar('🔐 Logging in...', 'info');
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
            console.log(`✅ Login successful! User role: ${currentUser.role}`);
            
            // Add login notification
            addNotification('Welcome Back', `Welcome back ${currentUser.username}!`);
            
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
            showSnackbar('✅ Login successful!', 'success');
        } else {
            console.error('❌ Login failed:', data.message);
            showSnackbar(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('💥 Login error:', error);
        showSnackbar('❌ Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('📝 Register form submitted');
    
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
    
    if (password.length < 8) {
        showSnackbar('Password must be at least 8 characters', 'error');
        return;
    }
    
    try {
        showSnackbar('📝 Creating account...', 'info');
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
            showSnackbar('✅ Account created successfully!', 'success');
            showScreen('login-screen');
            // Clear form
            document.getElementById('register-form').reset();
            
            // Add welcome notification
            addNotification('Welcome to BAYAN', `Welcome ${username}! Thank you for joining our community.`);
        } else {
            showSnackbar(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('💥 Registration error:', error);
        showSnackbar('❌ Registration failed. Please try again.', 'error');
    }
}

// Enhanced logout function
async function logout() {
    try {
        console.log('🔄 Attempting logout...');
        
        // Show loading state
        showSnackbar('🔐 Logging out...', 'info');
        
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Logout successful');
            currentUser = null;
            photoData = null;
            stream = null;
            
            // Add logout notification
            addNotification('Logged Out', 'You have been logged out successfully.');
            
            // Clear any stored data
            localStorage.removeItem('userReports');
            localStorage.removeItem('lastUpdateCheck');
            localStorage.removeItem('lastAdminUpdateCheck');
            localStorage.removeItem('lastNewReportCount');
            
            // Reset any UI elements
            document.getElementById('login-form')?.reset();
            document.getElementById('register-form')?.reset();
            document.getElementById('report-form')?.reset();
            
            // Close any open dropdowns
            const userDropdown = document.getElementById('user-dropdown');
            const adminDropdown = document.getElementById('admin-dropdown-menu');
            if (userDropdown) userDropdown.classList.add('hidden');
            if (adminDropdown) adminDropdown.classList.add('hidden');
            
            // Reset dropdown icons
            const userMenuIcon = document.querySelector('.dashboard-container .three-dot-menu i');
            const adminMenuIcon = document.querySelector('.admin-container .three-dot-menu i');
            if (userMenuIcon) userMenuIcon.style.transform = 'rotate(0deg)';
            if (adminMenuIcon) adminMenuIcon.style.transform = 'rotate(0deg)';
            
            // Close any open modals
            document.getElementById('camera-modal')?.classList.add('hidden');
            document.getElementById('resolution-modal')?.classList.add('hidden');
            
            // Stop camera stream if active
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            
            // Show login screen
            showScreen('login-screen');
            showSnackbar('✅ Logged out successfully!', 'success');
            
            // Clear photo preview
            removePhoto();
        } else {
            console.error('❌ Logout failed:', data.message);
            showSnackbar(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('💥 Logout error:', error);
        showSnackbar('❌ Failed to logout. Please check your connection.', 'error');
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
            document.getElementById('user-resolved-count').textContent = stats.resolved || 0;
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
            badge.textContent = data.count > 99 ? '99+' : data.count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load notifications count:', error);
    }
}

// Photo functions
function openCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-view');
    
    modal.classList.remove('hidden');
    
    // Request camera with higher quality
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment'
        } 
    })
        .then(function(mediaStream) {
            stream = mediaStream;
            video.srcObject = stream;
            video.play();
            
            // Add camera flash effect
            const flash = document.createElement('div');
            flash.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: white;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            `;
            video.parentElement.appendChild(flash);
            
            setTimeout(() => {
                flash.style.opacity = '0.3';
                setTimeout(() => {
                    flash.style.opacity = '0';
                    setTimeout(() => flash.remove(), 300);
                }, 100);
            }, 100);
        })
        .catch(function(error) {
            console.error('Camera error:', error);
            showSnackbar('Failed to access camera. Please check permissions.', 'error');
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
    
    // Draw video frame to canvas (mirrored for selfie-like view)
    context.save();
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    context.restore();
    
    // Apply slight enhancement
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    context.putImageData(imageData, 0, 0);
    
    photoData = canvas.toDataURL('image/jpeg', 0.9);
    
    // Show preview with animation
    const preview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');
    
    previewImage.src = photoData;
    preview.classList.remove('hidden');
    preview.style.animation = 'fadeIn 0.5s ease';
    
    // Add flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        opacity: 0;
        pointer-events: none;
        z-index: 1000;
        animation: flash 0.3s;
    `;
    document.body.appendChild(flash);
    
    setTimeout(() => flash.remove(), 300);
    
    closeCamera();
    showSnackbar('📸 Photo captured successfully!', 'success');
}

function handleFileUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showSnackbar('Please select a valid image file (JPEG, PNG)', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showSnackbar('Image size should be less than 10MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        photoData = e.target.result;
        
        // Show preview with animation
        const preview = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        
        previewImage.src = photoData;
        preview.classList.remove('hidden');
        preview.style.animation = 'fadeIn 0.5s ease';
        
        showSnackbar('📁 Photo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    photoData = null;
    const preview = document.getElementById('photo-preview');
    preview.style.animation = 'fadeOut 0.5s ease';
    setTimeout(() => {
        preview.classList.add('hidden');
    }, 500);
}

// Navigation functions
function showScreen(screenId) {
    console.log(`🔄 Switching to screen: ${screenId}`);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.style.animation = 'fadeIn 0.5s ease';
        console.log(`✅ Screen ${screenId} is now active`);
        
        // Scroll to top
        window.scrollTo(0, 0);
    } else {
        console.error(`❌ Screen ${screenId} not found!`);
    }
}

function showMyReports() {
    // Close dropdown before switching
    const userDropdown = document.getElementById('user-dropdown');
    if (userDropdown) {
        userDropdown.classList.add('hidden');
        const userMenuIcon = document.querySelector('.dashboard-container .three-dot-menu i');
        if (userMenuIcon) userMenuIcon.style.transform = 'rotate(0deg)';
    }
    
    showScreen('my-reports-screen');
    loadMyReports();
}

async function loadMyReports() {
    try {
        // Show loading skeleton
        const reportsList = document.getElementById('reports-list');
        reportsList.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${Array(3).fill().map(() => `
                    <div class="report-card" style="animation: pulse 1.5s infinite;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                            <div style="width: 80px; height: 24px; background: var(--border-color); border-radius: 6px;"></div>
                            <div style="width: 60px; height: 24px; background: var(--border-color); border-radius: 6px;"></div>
                        </div>
                        <div style="width: 100%; height: 16px; background: var(--border-color); border-radius: 6px; margin-bottom: 8px;"></div>
                        <div style="width: 80%; height: 16px; background: var(--border-color); border-radius: 6px; margin-bottom: 16px;"></div>
                        <div style="display: flex; justify-content: space-between;">
                            <div style="width: 60px; height: 12px; background: var(--border-color); border-radius: 6px;"></div>
                            <div style="width: 40px; height: 12px; background: var(--border-color); border-radius: 6px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        const response = await fetch('/api/user_reports');
        const data = await response.json();
        
        if (data.success && data.reports.length > 0) {
            reportsList.innerHTML = data.reports.map(report => `
                <div class="report-card fade-in">
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            <i class="fas ${getStatusIcon(report.status)}"></i> ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span><i class="fas fa-calendar"></i> ${report.date}</span>
                        <span><i class="fas fa-flag"></i> ${report.priority}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="photo-preview" style="margin-top: 12px;">
                            <img src="${report.photo_data}" alt="Report photo" onclick="viewImage('${report.photo_data}')" style="cursor: pointer;">
                        </div>
                    ` : ''}
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 12px; padding: 12px; background: var(--success-light); border-radius: 8px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;">
                                <div>
                                    <div style="display: flex; align-items: center; margin-bottom: 4px;">
                                        <i class="fas fa-check-circle" style="color: var(--success-color); margin-right: 8px;"></i>
                                        <strong style="color: var(--success-color); font-size: 14px;">
                                            Report Resolved
                                        </strong>
                                    </div>
                                    ${report.auditor_name ? `
                                        <div style="display: flex; align-items: center;">
                                            <i class="fas fa-user-check" style="color: var(--primary-color); margin-right: 8px;"></i>
                                            <span style="color: var(--text-secondary); font-size: 13px;">
                                                Audited by: ${report.auditor_name}
                                            </span>
                                        </div>
                                    ` : ''}
                                </div>
                                ${report.resolved_at ? `
                                    <div style="display: flex; align-items: center; color: var(--text-muted); font-size: 12px;">
                                        <i class="fas fa-clock" style="margin-right: 4px;"></i>
                                        ${report.resolved_at}
                                    </div>
                                ` : ''}
                            </div>
                            ${report.resolution_notes ? `
                                <div style="margin-top: 8px; padding: 10px; background: white; border-radius: 6px; border: 1px solid var(--success-color);">
                                    <strong style="color: var(--success-color); font-size: 13px; display: block; margin-bottom: 4px;">Resolution Notes:</strong>
                                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.4;">${report.resolution_notes}</p>
                                </div>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: var(--text-muted); font-size: 13px; font-style: italic;">
                                    No additional resolution details provided.
                                </p>
                            `}
                        </div>
                    ` : ''}
                    <div class="report-actions" style="margin-top: 12px; display: flex; justify-content: flex-end;">
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, false)" style="padding: 8px 16px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <i class="fas fa-file-alt" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 12px;">No Reports Yet</h3>
                    <p style="margin-bottom: 24px;">You haven't submitted any reports yet.</p>
                    <button class="btn btn-primary" onclick="showScreen('user-dashboard')">
                        <i class="fas fa-plus"></i> Submit Your First Report
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load reports:', error);
        const reportsList = document.getElementById('reports-list');
        reportsList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <i class="fas fa-exclamation-triangle" style="font-size: 64px; margin-bottom: 20px; color: var(--danger-color);"></i>
                <h3 style="color: var(--text-primary); margin-bottom: 12px;">Failed to Load Reports</h3>
                <p style="margin-bottom: 24px;">Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadMyReports()">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Helper function for status icons
function getStatusIcon(status) {
    switch(status) {
        case 'Pending': return 'fa-clock';
        case 'In Progress': return 'fa-spinner fa-spin';
        case 'Resolved': return 'fa-check-circle';
        default: return 'fa-info-circle';
    }
}

// View image in modal
function viewImage(src) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90vw; max-height: 90vh; background: transparent;">
            <button class="close-btn" onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white;">&times;</button>
            <img src="${src}" alt="Full size" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">
        </div>
    `;
    document.body.appendChild(modal);
}

// Show notifications screen
function showNotifications() {
    showScreen('notifications-screen');
    loadNotifications();
}

// Load notifications
async function loadNotifications() {
    try {
        const notificationsList = document.getElementById('notifications-list');
        
        if (notifications.length > 0) {
            notificationsList.innerHTML = `
                <div class="notifications-header">
                    <div class="notifications-stats">
                        <div class="stat-badge">
                            <i class="fas fa-bell"></i>
                            <span>${notifications.length} Notifications</span>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="markAllAsRead()" style="padding: 8px 16px;">
                            <i class="fas fa-check-double"></i>
                            Mark All Read
                        </button>
                    </div>
                </div>
                <div class="notifications-container">
                    ${notifications.map((notification, index) => `
                        <div class="notification-item ${!notification.read ? 'unread' : ''}" onclick="handleNotificationClick(${index})">
                            <div class="notification-icon" style="background: ${getNotificationColor(notification.title)};">
                                <i class="fas ${getNotificationIcon(notification.message)}"></i>
                            </div>
                            <div class="notification-content">
                                <div class="notification-message">${notification.message}</div>
                                <div class="notification-time">
                                    <i class="fas fa-clock"></i>
                                    ${notification.date} ${notification.time}
                                </div>
                            </div>
                            <div class="notification-actions">
                                <button class="icon-btn-small" onclick="event.stopPropagation(); deleteNotification(${index})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            notificationsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <h3>No Notifications</h3>
                    <p>You're all caught up! We'll notify you when there are updates.</p>
                    <button class="btn btn-primary" onclick="showScreen('user-dashboard')">
                        <i class="fas fa-home"></i>
                        Back to Dashboard
                    </button>
                </div>
            `;
        }
        
        // Update badge count
        updateNotificationBadge();
    } catch (error) {
        console.error('Failed to load notifications:', error);
        const notificationsList = document.getElementById('notifications-list');
        notificationsList.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Unable to Load Notifications</h3>
                <p>Please check your connection and try again.</p>
                <button class="btn btn-primary" onclick="loadNotifications()">
                    <i class="fas fa-redo"></i>
                    Try Again
                </button>
            </div>
        `;
    }
}

// Helper functions for notifications
function getNotificationColor(title) {
    if (title.includes('Resolved') || title.includes('Welcome')) return 'var(--success-color)';
    if (title.includes('Submitted') || title.includes('New')) return 'var(--primary-color)';
    if (title.includes('Status') || title.includes('Updated')) return 'var(--warning-color)';
    if (title.includes('Deleted') || title.includes('Failed')) return 'var(--danger-color)';
    return 'var(--secondary-color)';
}

function handleNotificationClick(index) {
    // Mark as read
    notifications[index].read = true;
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems[index].classList.remove('unread');
    
    // Update badge
    updateNotificationBadge();
    
    // Navigate based on notification type
    const notification = notifications[index];
    if (notification.title.includes('Report')) {
        showMyReports();
    }
}

function markAllAsRead() {
    notifications.forEach(notification => notification.read = true);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems.forEach(item => item.classList.remove('unread'));
    
    updateNotificationBadge();
    showSnackbar('All notifications marked as read', 'success');
}

function deleteNotification(index) {
    notifications.splice(index, 1);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    
    loadNotifications();
    updateNotificationBadge();
    showSnackbar('Notification deleted', 'success');
}

// Enhanced dropdown functions
function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    const menuBtn = document.querySelector('.dashboard-container .three-dot-menu');
    
    dropdown.classList.toggle('hidden');
    
    // Add rotation animation to the ellipsis icon
    const icon = menuBtn.querySelector('i');
    if (dropdown.classList.contains('hidden')) {
        icon.style.transform = 'rotate(0deg)';
    } else {
        icon.style.transform = 'rotate(90deg)';
    }
}

function toggleAdminDropdown() {
    const dropdown = document.getElementById('admin-dropdown-menu');
    const menuBtn = document.querySelector('.admin-container .three-dot-menu');
    
    dropdown.classList.toggle('hidden');
    
    // Add rotation animation to the ellipsis icon
    const icon = menuBtn.querySelector('i');
    if (dropdown.classList.contains('hidden')) {
        icon.style.transform = 'rotate(0deg)';
    } else {
        icon.style.transform = 'rotate(90deg)';
    }
}

async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const adminContainer = document.querySelector('.admin-container');
    adminContainer.innerHTML = `
        <div class="screen-header">
            <h2><i class="fas fa-shield-alt"></i> BAYAN Admin Dashboard</h2>
            <div class="admin-header-actions">
                <button class="icon-btn" onclick="showAdminNotifications()">
                    <i class="fas fa-bell"></i>
                    <span id="admin-notification-badge" class="badge hidden">0</span>
                </button>
                <div class="dropdown-container">
                    <button class="three-dot-menu" onclick="toggleAdminDropdown()">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div id="admin-dropdown-menu" class="dropdown-menu hidden">
                        <button class="dropdown-item" onclick="refreshAdminDashboard()">
                            <i class="fas fa-sync-alt"></i>
                            Refresh Dashboard
                        </button>
                        <button class="dropdown-item" onclick="exportReports()">
                            <i class="fas fa-file-export"></i>
                            Export Reports
                        </button>
                        <div class="divider"></div>
                        <button class="dropdown-item" onclick="logout()">
                            <i class="fas fa-sign-out-alt"></i>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Notification Status -->
        <div id="admin-notification-status" class="notification-status hidden">
            <!-- New reports notification will appear here -->
        </div>
        
        <!-- Filter Controls -->
        <div class="card">
            <h3><i class="fas fa-filter"></i> Filter Reports</h3>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
                <button class="btn btn-outline" onclick="filterReports('today')" style="flex: 1; min-width: 100px;">
                    <i class="fas fa-calendar-day"></i> Today
                </button>
                <button class="btn btn-outline" onclick="filterReports('week')" style="flex: 1; min-width: 100px;">
                    <i class="fas fa-calendar-week"></i> This Week
                </button>
                <button class="btn btn-outline" onclick="filterReports('month')" style="flex: 1; min-width: 100px;">
                    <i class="fas fa-calendar-alt"></i> This Month
                </button>
                <button class="btn btn-outline" onclick="filterReports('all')" style="flex: 1; min-width: 100px;">
                    <i class="fas fa-calendar"></i> All Time
                </button>
            </div>
            <div id="filter-indicator" style="text-align: center; color: var(--text-muted); font-size: 14px; padding: 12px; background: var(--background-color); border-radius: 8px;">
                <i class="fas fa-info-circle"></i> Showing: All Time Reports
            </div>
        </div>
        
        <div class="admin-stats" id="admin-stats">
            <!-- Stats will be loaded here -->
        </div>
        
        <div class="card">
            <h3><i class="fas fa-file-alt"></i> Recent Reports</h3>
            <div id="admin-reports-list" class="admin-reports-list">
                <!-- Reports will be loaded here -->
            </div>
        </div>
    `;
    
    await loadAdminStats();
    await loadAllReports();
    await checkNewReportsNotification();
    await loadAdminNotificationsCount();
    updateNotificationBadge();
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            const statsContainer = document.getElementById('admin-stats');
            
            statsContainer.innerHTML = `
                <div class="admin-stat-card" onclick="filterReports('all')" style="cursor: pointer;">
                    <div class="admin-stat-value">${stats.total}</div>
                    <div class="admin-stat-label">Total Reports</div>
                </div>
                <div class="admin-stat-card" onclick="filterReports('pending')" style="cursor: pointer;">
                    <div class="admin-stat-value">${stats.pending}</div>
                    <div class="admin-stat-label">Pending</div>
                </div>
                <div class="admin-stat-card" onclick="filterReports('in_progress')" style="cursor: pointer;">
                    <div class="admin-stat-value">${stats.in_progress}</div>
                    <div class="admin-stat-label">In Progress</div>
                </div>
                <div class="admin-stat-card" onclick="filterReports('resolved')" style="cursor: pointer;">
                    <div class="admin-stat-value">${stats.resolved}</div>
                    <div class="admin-stat-label">Resolved</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

async function loadAllReports() {
    try {
        const response = await fetch('/api/all_reports');
        const data = await response.json();
        
        const reportsList = document.getElementById('admin-reports-list');
        
        if (data.success && data.reports.length > 0) {
            // Set initial filter indicator
            const filterIndicator = document.getElementById('filter-indicator');
            if (filterIndicator) {
                filterIndicator.innerHTML = `<i class="fas fa-info-circle"></i> Showing: All Time (${data.reports.length} reports)`;
            }
            
            reportsList.innerHTML = data.reports.map(report => `
                <div class="report-card fade-in">
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            <i class="fas ${getStatusIcon(report.status)}"></i> ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span><i class="fas fa-user"></i> ${report.username}</span>
                        <span><i class="fas fa-calendar"></i> ${report.date}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="photo-preview" style="margin-top: 12px;">
                            <img src="${report.photo_data}" alt="Report photo" onclick="viewImage('${report.photo_data}')" style="cursor: pointer;">
                        </div>
                    ` : ''}
                    <div class="admin-actions" style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <select class="status-select" data-report-id="${report.id}" onchange="handleStatusChange(this, ${report.id})" style="flex: 2; padding: 10px 14px; border-radius: 8px; border: 2px solid var(--border-color); min-width: 140px; background: var(--surface-color); color: var(--text-primary); font-weight: 600;">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>🔄 In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)" style="padding: 10px 16px; flex: 1; min-width: 100px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 12px; padding: 16px; background: var(--success-light); border-radius: 8px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap;">
                                <strong style="color: var(--success-color); font-size: 14px;">✅ Resolution Details</strong>
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                    ${report.auditor_name ? `
                                        <span style="color: var(--text-secondary); font-size: 13px;">
                                            <i class="fas fa-user-check"></i> Audited by: ${report.auditor_name}
                                        </span>
                                    ` : ''}
                                    ${report.resolved_at ? `
                                        <span style="color: var(--text-muted); font-size: 13px;">
                                            <i class="fas fa-clock"></i> ${report.resolved_at}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            ${report.resolution_notes ? `
                                <p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 14px; line-height: 1.5; padding: 12px; background: rgba(255,255,255,0.5); border-radius: 6px;">${report.resolution_notes}</p>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: var(--text-muted); font-size: 14px; font-style: italic;">
                                    No resolution details provided.
                                </p>
                            `}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <i class="fas fa-file-alt" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 12px;">No Reports Found</h3>
                    <p>There are no reports in the system yet.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load all reports:', error);
        showSnackbar('❌ Failed to load reports', 'error');
    }
}

// Delete report functions
async function deleteReport(reportId, isAdmin = false) {
    if (!confirm('⚠️ Are you sure you want to delete this report?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        const endpoint = isAdmin ? '/api/delete_report' : '/api/delete_user_report';
        
        showSnackbar('🗑️ Deleting report...', 'info');
        
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
            showSnackbar('✅ Report deleted successfully!', 'success');
            // Add notification
            addNotification('Report Deleted', `Report #${reportId} has been deleted.`);
            
            // Reload the appropriate list
            if (isAdmin) {
                await loadAllReports();
                await loadAdminStats();
            } else {
                await loadMyReports();
                await loadStats();
            }
        } else {
            showSnackbar(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Delete report error:', error);
        showSnackbar('❌ Failed to delete report', 'error');
    }
}

// Export reports function
function exportReports() {
    showSnackbar('📊 Preparing report export...', 'info');
    
    // Simulate export process
    setTimeout(() => {
        const data = {
            timestamp: new Date().toISOString(),
            user: currentUser.username,
            reports: notifications
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bayan-reports-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSnackbar('✅ Reports exported successfully!', 'success');
        addNotification('Reports Exported', 'All reports have been exported successfully.');
    }, 1000);
}

// Utility functions
function showSnackbar(message, type = 'success') {
    // Remove existing snackbar
    const existingSnackbar = document.getElementById('snackbar');
    if (existingSnackbar) {
        existingSnackbar.remove();
    }
    
    // Create snackbar
    const snackbar = document.createElement('div');
    snackbar.id = 'snackbar';
    snackbar.className = `snackbar ${type}`;
    snackbar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; padding: 4px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(snackbar);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (snackbar.parentElement) {
            snackbar.remove();
        }
    }, 5000);
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
        console.log('✅ Loading screen hidden');
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
        icon.style.color = 'var(--primary-color)';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
        icon.style.color = '';
    }
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
                    await loadAdminNotificationsCount();
                }
            } catch (error) {
                console.error('Periodic report check failed:', error);
            }
        }, 30000);
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
    notification.className = 'new-reports-alert';
    notification.innerHTML = `
        <div class="alert-content">
            <i class="fas fa-bell" style="font-size: 20px;"></i>
            <div class="alert-text">
                <strong>${count} new report${count > 1 ? 's' : ''} submitted!</strong>
                <span>Click to view</span>
            </div>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
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

// Snowflake animation
function createSnowflakes() {
    const snowflakesContainer = document.querySelector('.snowflakes');
    if (!snowflakesContainer) {
        snowflakesContainer = document.createElement('div');
        snowflakesContainer.className = 'snowflakes';
        document.body.appendChild(snowflakesContainer);
    }
    
    // Create snowflakes
    for (let i = 0; i < 20; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.animationDuration = `${10 + Math.random() * 20}s`;
        snowflake.style.animationDelay = `${Math.random() * 5}s`;
        snowflake.style.opacity = `${0.3 + Math.random() * 0.7}`;
        snowflakesContainer.appendChild(snowflake);
    }
}

// Load admin notifications count for the bell
async function loadAdminNotificationsCount() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/new_reports_count');
        const data = await response.json();
        
        const badge = document.getElementById('admin-notification-badge');
        if (data.success && data.count > 0) {
            badge.textContent = data.count > 99 ? '99+' : data.count;
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
                    <h3><i class="fas fa-bell"></i> Admin Notifications</h3>
                    <button class="close-btn" onclick="document.getElementById('admin-notifications-modal').classList.add('hidden')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="admin-notifications-list" class="notifications-list">
                        <!-- Notifications will be loaded here -->
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-outline" onclick="clearAllNotifications()">
                        <i class="fas fa-trash"></i> Clear All
                    </button>
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('admin-notifications-modal').classList.add('hidden')">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    loadAdminNotifications();
    modal.classList.remove('hidden');
}

// Clear all notifications
function clearAllNotifications() {
    notifications = [];
    localStorage.removeItem('notifications');
    loadAdminNotifications();
    updateNotificationBadge();
    showSnackbar('All notifications cleared', 'success');
}

// Load admin notifications
async function loadAdminNotifications() {
    try {
        const notificationsList = document.getElementById('admin-notifications-list');
        
        if (notifications.length > 0) {
            notificationsList.innerHTML = `
                <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="stat-badge">
                        <i class="fas fa-bell"></i>
                        <span>${notifications.length} Notifications</span>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="markAllAsRead()" style="padding: 6px 12px;">
                        <i class="fas fa-check-double"></i> Mark All Read
                    </button>
                </div>
                <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                    ${notifications.map((notification, index) => `
                        <div class="notification-item ${!notification.read ? 'unread' : ''}" style="margin-bottom: 12px; cursor: pointer;" onclick="handleNotificationClick(${index})">
                            <div class="notification-icon" style="background: ${getNotificationColor(notification.title)};">
                                <i class="fas ${getNotificationIcon(notification.message)}"></i>
                            </div>
                            <div class="notification-content">
                                <strong style="display: block; margin-bottom: 4px; color: var(--text-primary);">${notification.title}</strong>
                                <div class="notification-message">${notification.message}</div>
                                <div class="notification-time">
                                    <i class="fas fa-clock"></i>
                                    ${notification.date} ${notification.time}
                                </div>
                            </div>
                            <div class="notification-actions">
                                <button class="icon-btn-small" onclick="event.stopPropagation(); deleteNotification(${index})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fas fa-bell-slash" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 12px;">No Notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            `;
        }
        
        // Update badge count
        updateNotificationBadge();
    } catch (error) {
        console.error('Failed to load admin notifications:', error);
        const notificationsList = document.getElementById('admin-notifications-list');
        notificationsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fas fa-exclamation-triangle" style="font-size: 64px; margin-bottom: 20px; color: var(--danger-color);"></i>
                <h3 style="color: var(--text-primary); margin-bottom: 12px;">Failed to Load</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// Filter reports by time period
async function filterReports(period) {
    try {
        console.log(`🔍 Filtering reports for: ${period}`);
        
        // Show loading
        const reportsList = document.getElementById('admin-reports-list');
        reportsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="font-size: 40px; margin-bottom: 20px;"></i>
                <p>Loading reports...</p>
            </div>
        `;
        
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
                    
                case 'pending':
                    filteredReports = data.reports.filter(report => report.status === 'Pending');
                    break;
                    
                case 'in_progress':
                    filteredReports = data.reports.filter(report => report.status === 'In Progress');
                    break;
                    
                case 'resolved':
                    filteredReports = data.reports.filter(report => report.status === 'Resolved');
                    break;
                    
                case 'all':
                default:
                    filteredReports = data.reports;
                    break;
            }
            
            displayFilteredReports(filteredReports, period);
            updateFilterStats(filteredReports, period);
        } else {
            reportsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fas fa-file-alt" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 12px;">No Reports Found</h3>
                    <p>There are no reports matching your filter.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to filter reports:', error);
        showSnackbar('❌ Failed to filter reports', 'error');
    }
}

// Display filtered reports
function displayFilteredReports(reports, period) {
    const reportsList = document.getElementById('admin-reports-list');
    
    if (reports.length > 0) {
        // Check if any report is from last 24 hours
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        reportsList.innerHTML = reports.map(report => {
            const reportDate = new Date(report.date);
            const isNewReport = reportDate >= yesterday;
            
            return `
                <div class="report-card fade-in ${isNewReport ? 'new-report-highlight' : ''}">
                    ${isNewReport ? `
                        <div style="position: absolute; top: 12px; right: 12px; z-index: 1;">
                            <span style="background: var(--gradient-primary); color: white; padding: 6px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; display: flex; align-items: center; gap: 4px; box-shadow: var(--shadow-sm);">
                                <i class="fas fa-star"></i> NEW
                            </span>
                        </div>
                    ` : ''}
                    <div class="report-header">
                        <span class="report-type">${report.problem_type}</span>
                        <span class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                            <i class="fas ${getStatusIcon(report.status)}"></i> ${report.status}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <span><i class="fas fa-user"></i> ${report.username}</span>
                        <span><i class="fas fa-calendar"></i> ${report.date}</span>
                    </div>
                    ${report.photo_data ? `
                        <div class="photo-preview" style="margin-top: 12px;">
                            <img src="${report.photo_data}" alt="Report photo" onclick="viewImage('${report.photo_data}')" style="cursor: pointer;">
                        </div>
                    ` : ''}
                    <div class="admin-actions" style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <select class="status-select" data-report-id="${report.id}" onchange="handleStatusChange(this, ${report.id})" style="flex: 2; padding: 10px 14px; border-radius: 8px; border: 2px solid var(--border-color); min-width: 140px; background: var(--surface-color); color: var(--text-primary); font-weight: 600;">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>🔄 In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id}, true)" style="padding: 10px 16px; flex: 1; min-width: 100px;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                    ${report.status === 'Resolved' ? `
                        <div class="resolution-notes" style="margin-top: 12px; padding: 16px; background: var(--success-light); border-radius: 8px; border-left: 4px solid var(--success-color);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap;">
                                <strong style="color: var(--success-color); font-size: 14px;">✅ Resolution Details</strong>
                                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                    ${report.auditor_name ? `
                                        <span style="color: var(--text-secondary); font-size: 13px;">
                                            <i class="fas fa-user-check"></i> Audited by: ${report.auditor_name}
                                        </span>
                                    ` : ''}
                                    ${report.resolved_at ? `
                                        <span style="color: var(--text-muted); font-size: 13px;">
                                            <i class="fas fa-clock"></i> ${report.resolved_at}
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            ${report.resolution_notes ? `
                                <p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 14px; line-height: 1.5; padding: 12px; background: rgba(255,255,255,0.5); border-radius: 6px;">${report.resolution_notes}</p>
                            ` : `
                                <p style="margin: 8px 0 0 0; color: var(--text-muted); font-size: 14px; font-style: italic;">
                                    No resolution details provided.
                                </p>
                            `}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Update filter indicator
        const filterIndicator = document.getElementById('filter-indicator');
        if (filterIndicator) {
            const periodText = {
                'today': 'Today',
                'week': 'This Week', 
                'month': 'This Month',
                'all': 'All Time',
                'pending': 'Pending',
                'in_progress': 'In Progress',
                'resolved': 'Resolved'
            }[period] || 'Filtered';
            
            filterIndicator.innerHTML = `<i class="fas fa-filter"></i> Showing: ${periodText} (${reports.length} reports)`;
        }
    } else {
        const periodText = {
            'today': 'today',
            'week': 'this week', 
            'month': 'this month',
            'all': 'all time',
            'pending': 'pending',
            'in_progress': 'in progress',
            'resolved': 'resolved'
        }[period] || 'selected';
        
        reportsList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                <i class="fas fa-file-alt" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                <h3 style="color: var(--text-primary); margin-bottom: 12px;">No Reports Found</h3>
                <p style="margin-bottom: 24px;">There are no ${periodText} reports.</p>
                <button class="btn btn-primary" onclick="filterReports('all')">
                    <i class="fas fa-eye"></i> View All Reports
                </button>
            </div>
        `;
    }
}

// Update stats for filtered reports
function updateFilterStats(reports, period) {
    const total = reports.length;
    const pending = reports.filter(r => r.status === 'Pending').length;
    const inProgress = reports.filter(r => r.status === 'In Progress').length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    
    const statsContainer = document.getElementById('admin-stats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="admin-stat-card" onclick="filterReports('${period === 'all' ? 'all' : period}')" style="cursor: pointer;">
                <div class="admin-stat-value">${total}</div>
                <div class="admin-stat-label">Total Reports</div>
            </div>
            <div class="admin-stat-card" onclick="filterReports('${period === 'all' ? 'pending' : period}')" style="cursor: pointer;">
                <div class="admin-stat-value">${pending}</div>
                <div class="admin-stat-label">Pending</div>
            </div>
            <div class="admin-stat-card" onclick="filterReports('${period === 'all' ? 'in_progress' : period}')" style="cursor: pointer;">
                <div class="admin-stat-value">${inProgress}</div>
                <div class="admin-stat-label">In Progress</div>
            </div>
            <div class="admin-stat-card" onclick="filterReports('${period === 'all' ? 'resolved' : period}')" style="cursor: pointer;">
                <div class="admin-stat-value">${resolved}</div>
                <div class="admin-stat-label">Resolved</div>
            </div>
        `;
    }
}

// Enhanced refresh admin dashboard function
async function refreshAdminDashboard() {
    try {
        showSnackbar('🔄 Refreshing dashboard...', 'info');
        
        // Hide any open dropdowns
        const adminDropdown = document.getElementById('admin-dropdown-menu');
        if (adminDropdown && !adminDropdown.classList.contains('hidden')) {
            adminDropdown.classList.add('hidden');
            const menuBtn = document.querySelector('.admin-container .three-dot-menu');
            const icon = menuBtn?.querySelector('i');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
        
        // Add rotation animation to refresh
        const refreshBtn = document.querySelector('.dropdown-item[onclick="refreshAdminDashboard()"] i');
        if (refreshBtn) {
            refreshBtn.className = 'fas fa-spinner fa-spin';
            setTimeout(() => {
                refreshBtn.className = 'fas fa-sync-alt';
            }, 1000);
        }
        
        await Promise.all([
            loadAdminStats(),
            loadAllReports(),
            loadAdminNotificationsCount()
        ]);
        
        showSnackbar('✅ Dashboard refreshed successfully!', 'success');
        addNotification('Dashboard Refreshed', 'Admin dashboard has been refreshed with latest data.');
    } catch (error) {
        console.error('Failed to refresh admin dashboard:', error);
        showSnackbar('❌ Failed to refresh dashboard', 'error');
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes flash {
        0% { opacity: 0; }
        50% { opacity: 0.7; }
        100% { opacity: 0; }
    }
    
    @keyframes scaleUp {
        from { transform: scale(0.5); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    .new-report-highlight {
        position: relative;
        border: 2px solid var(--primary-color);
        animation: pulse 2s infinite;
    }
    
    .status-select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);

// Make functions globally available
window.openCamera = openCamera;
window.closeCamera = closeCamera;
window.capturePhoto = capturePhoto;
window.handleFileUpload = handleFileUpload;
window.removePhoto = removePhoto;
window.toggleDropdown = toggleDropdown;
window.toggleAdminDropdown = toggleAdminDropdown;
window.showScreen = showScreen;
window.showMyReports = showMyReports;
window.showNotifications = showNotifications;
window.logout = logout;
window.togglePassword = togglePassword;
window.handleStatusChange = handleStatusChange;
window.showResolutionModal = showResolutionModal;
window.cancelResolution = cancelResolution;
window.submitResolution = submitResolution;
window.deleteReport = deleteReport;
window.refreshAdminDashboard = refreshAdminDashboard;
window.filterReports = filterReports;
window.viewImage = viewImage;
window.exportReports = exportReports;
window.markAllAsRead = markAllAsRead;
window.deleteNotification = deleteNotification;
window.handleNotificationClick = handleNotificationClick;
window.showAdminNotifications = showAdminNotifications;
window.clearAllNotifications = clearAllNotifications;

console.log('🚀 BAYAN System Initialized Successfully!');

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
    
    // Setup dropdown click handlers
    setupDropdownHandlers();
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
}

// Enhanced Report functions
async function handleReportSubmit(e) {
    e.preventDefault();
    
    console.log('🔍 Report form submitted - Starting validation');
    
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
            showSnackbar('Report submitted successfully!');
            // Reset form
            document.getElementById('report-form').reset();
            removePhoto();
            // Refresh stats
            await loadStats();
            console.log('🔄 Stats refreshed after report submission');
        } else {
            console.error('❌ Report submission failed:', data.message);
            showSnackbar(data.message || 'Failed to submit report', 'error');
        }
    } catch (error) {
        console.error('💥 Report submission error:', error);
        showSnackbar('Failed to submit report. Please try again.', 'error');
    } finally {
        // Reset button state
        const submitBtn = document.getElementById('submit-report-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';
            submitBtn.disabled = false;
        }
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
    
    if (!issue.trim()) {
        showSnackbar('Please describe the issue', 'error');
        document.getElementById('issue').focus();
        return false;
    }
    
    return true;
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

// Authentication functions
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

// FIXED: Enhanced logout function
async function logout() {
    try {
        console.log('🔄 Attempting logout...');
        
        // Show loading state
        showSnackbar('Logging out...');
        
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Logout successful');
            currentUser = null;
            photoData = null;
            stream = null;
            
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
            showSnackbar('Logged out successfully!');
            
            // Clear photo preview
            removePhoto();
        } else {
            console.error('❌ Logout failed:', data.message);
            showSnackbar('Logout failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('💥 Logout error:', error);
        showSnackbar('Failed to logout. Please check your connection.', 'error');
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

// Show notifications screen with improved UI/UX
function showNotifications() {
    showScreen('notifications-screen');
    loadNotifications();
}

// Load notifications with improved design
async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        const notificationsList = document.getElementById('notifications-list');
        
        if (data.success && data.notifications.length > 0) {
            notificationsList.innerHTML = `
                <div class="notifications-header">
                    <div class="notifications-stats">
                        <div class="stat-badge">
                            <i class="fas fa-bell"></i>
                            <span>${data.notifications.length} Notifications</span>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="markAllAsRead()" style="padding: 4px 12px;">
                            <i class="fas fa-check-double"></i>
                            Mark All Read
                        </button>
                    </div>
                </div>
                <div class="notifications-container">
                    ${data.notifications.map((notification, index) => `
                        <div class="notification-item ${index === 0 ? 'new-notification' : ''}" onclick="handleNotificationClick(${index})">
                            <div class="notification-icon">
                                <i class="fas ${getNotificationIcon(notification.message)}"></i>
                            </div>
                            <div class="notification-content">
                                <div class="notification-message">${notification.message}</div>
                                <div class="notification-time">
                                    <i class="fas fa-clock"></i>
                                    ${formatTimeAgo(notification.created_at)}
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
        await loadNotificationsCount();
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
function getNotificationIcon(message) {
    if (message.includes('resolved') || message.includes('Resolved')) {
        return 'fa-check-circle text-success';
    } else if (message.includes('submitted') || message.includes('Submitted')) {
        return 'fa-plus-circle text-primary';
    } else if (message.includes('status') || message.includes('Status')) {
        return 'fa-sync-alt text-warning';
    } else if (message.includes('deleted') || message.includes('Deleted')) {
        return 'fa-trash text-danger';
    }
    return 'fa-info-circle text-info';
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return time.toLocaleDateString();
}

function handleNotificationClick(index) {
    // Mark as read and navigate if needed
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems[index].classList.remove('new-notification');
    
    // You can add specific navigation logic based on notification content
    showSnackbar('Notification marked as read', 'success');
}

function markAllAsRead() {
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems.forEach(item => item.classList.remove('new-notification'));
    showSnackbar('All notifications marked as read', 'success');
}

function deleteNotification(index) {
    // In a real app, you would call an API to delete the notification
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems[index].style.opacity = '0';
    setTimeout(() => {
        notificationItems[index].remove();
        showSnackbar('Notification deleted', 'success');
    }, 300);
}

// FIXED: Enhanced dropdown functions
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
        <h2>Admin Dashboard</h2>
        <div class="header-actions">
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
                        Refresh
                    </button>
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

// Temporary fix function
function forceShowLogin() {
    console.log('Manual override: forcing login screen');
    hideLoading();
    showScreen('login-screen');
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

// Snowflake animation
function createSnowflakes() {
    const snowflakesContainer = document.createElement('div');
    snowflakesContainer.className = 'snowflakes';
    
    // Create 20 snowflakes
    for (let i = 0; i < 20; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        snowflakesContainer.appendChild(snowflake);
    }
    
    document.body.appendChild(snowflakesContainer);
}

// Initialize snowflakes when the page loads
document.addEventListener('DOMContentLoaded', function() {
    createSnowflakes();
});

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
        const notificationsList = document.getElementById('admin-notifications-list');
        // Show loading state
        notificationsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 16px;"></div>
                <p style="color: var(--text-muted);">Loading notifications...</p>
            </div>
        `;

        // Get new reports count
        const response = await fetch('/api/new_reports_count');
        const data = await response.json();

        if (data.success && data.count > 0) {
            // Get detailed reports info
            const reportsResponse = await fetch('/api/all_reports');
            const reportsData = await reportsResponse.json();

            if (reportsData.success) {
                const yesterday = new Date();
                yesterday.setHours(yesterday.getHours() - 24);

                const newReports = reportsData.reports.filter(report => {
                    const reportDate = new Date(report.date);
                    return reportDate >= yesterday;
                });

                // Group by status or type if needed, for now just display all
                notificationsList.innerHTML = `
                    <div class="notification-header">
                        <i class="fas fa-bell" style="color: #667eea;"></i>
                        <span><strong>${data.count} new report${data.count > 1 ? 's' : ''} in last 24 hours</strong></span>
                    </div>
                    <div class="new-reports-list">
                        ${newReports.map(report => `
                            <div class="new-report-item" onclick="viewReport(${report.id})" style="cursor: pointer;">
                                <div class="report-icon">
                                    <i class="fas fa-file-alt"></i>
                                </div>
                                <div class="report-content">
                                    <div class="report-header">
                                        <div class="report-type">${report.problem_type}</div>
                                        <div class="report-time">${formatTimeAgo(report.date)}</div>
                                    </div>
                                    <div class="report-details">
                                        <p class="report-location"><i class="fas fa-location-dot"></i> ${report.location}</p>
                                        <p class="report-submitter"><i class="fas fa-user"></i> ${report.username}</p>
                                    </div>
                                    <div class="report-status status-${report.status.toLowerCase().replace(' ', '-')}">
                                        ${report.status}
                                    </div>
                                </div>
                                <div class="report-actions">
                                    <button class="btn-mark-read" onclick="event.stopPropagation(); markReportAsRead(${report.id})" title="Mark as read">
                                        <i class="fas fa-check"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } else {
            notificationsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
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
            <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p>Failed to load notifications</p>
            </div>
        `;
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

// FIXED: Enhanced refresh admin dashboard function
async function refreshAdminDashboard() {
    try {
        showSnackbar('Refreshing dashboard...', 'info');
        
        // Hide any open dropdowns
        const adminDropdown = document.getElementById('admin-dropdown-menu');
        if (adminDropdown && !adminDropdown.classList.contains('hidden')) {
            adminDropdown.classList.add('hidden');
            const menuBtn = document.querySelector('.admin-container .three-dot-menu');
            const icon = menuBtn?.querySelector('i');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
        
        await loadAdminStats();
        await loadAllReports();
        await loadAdminNotificationsCount();
        
        showSnackbar('Dashboard refreshed successfully!', 'success');
    } catch (error) {
        console.error('Failed to refresh admin dashboard:', error);
        showSnackbar('Failed to refresh dashboard', 'error');
    }
}

// ========================
// IMPROVED NAVIGATION
// ========================

// Add breadcrumb navigation
function updateBreadcrumb(screen) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    const crumbs = {
        'login-screen': ['Login'],
        'user-dashboard': ['Dashboard', 'Home'],
        'my-reports-screen': ['Dashboard', 'My Reports'],
        'admin-dashboard': ['Admin', 'Dashboard'],
        'notifications-screen': ['Dashboard', 'Notifications']
    };
    
    if (crumbs[screen]) {
        breadcrumb.innerHTML = crumbs[screen].map(crumb => 
            `<span class="breadcrumb-item">${crumb}</span>`
        ).join('<span class="breadcrumb-separator">›</span>');
    }
}

// Smooth screen transitions
function showScreen(screenId) {
    const currentScreen = document.querySelector('.screen.active');
    const targetScreen = document.getElementById(screenId);
    
    if (currentScreen) {
        currentScreen.classList.add('fade-out');
        setTimeout(() => {
            currentScreen.classList.remove('active', 'fade-out');
            
            if (targetScreen) {
                targetScreen.classList.add('fade-in');
                setTimeout(() => {
                    targetScreen.classList.add('active');
                    targetScreen.classList.remove('fade-in');
                    updateBreadcrumb(screenId);
                    updatePageTitle(screenId);
                }, 50);
            }
        }, 200);
    }
}

// ========================
// IMPROVED FORM HANDLING
// ========================

// Real-time form validation
function setupFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', validateField);
        });
    });
}

function validateField(e) {
    const field = e.target;
    const errorElement = field.parentElement.querySelector('.field-error');
    
    // Clear previous error
    if (errorElement) {
        errorElement.remove();
    }
    
    // Validate based on input type
    let isValid = true;
    let errorMessage = '';
    
    if (field.required && !field.value.trim()) {
        isValid = false;
        errorMessage = 'This field is required';
    } else if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    } else if (field.type === 'password' && field.value) {
        if (field.value.length < 6) {
            isValid = false;
            errorMessage = 'Password must be at least 6 characters';
        }
    }
    
    // Show/hide error
    if (!isValid) {
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = errorMessage;
        errorDiv.style.color = 'var(--danger-color)';
        errorDiv.style.fontSize = 'var(--text-sm)';
        errorDiv.style.marginTop = '0.25rem';
        field.parentElement.appendChild(errorDiv);
    } else {
        field.classList.remove('error');
        field.classList.add('success');
    }
    
    return isValid;
}

// ========================
// IMPROVED FEEDBACK SYSTEM
// ========================

// Enhanced snackbar with progress
function showSnackbar(message, type = 'info', duration = 4000) {
    // Remove existing snackbar
    const existing = document.getElementById('snackbar');
    if (existing) existing.remove();
    
    // Create new snackbar
    const snackbar = document.createElement('div');
    snackbar.id = 'snackbar';
    snackbar.className = `snackbar snackbar-${type}`;
    snackbar.innerHTML = `
        <div class="snackbar-content">
            <i class="fas ${getSnackbarIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <div class="snackbar-progress"></div>
    `;
    
    document.body.appendChild(snackbar);
    
    // Show with animation
    setTimeout(() => snackbar.classList.add('show'), 10);
    
    // Auto-hide
    setTimeout(() => {
        snackbar.classList.remove('show');
        setTimeout(() => snackbar.remove(), 300);
    }, duration);
}

function getSnackbarIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
}

// ========================
// IMPROVED IMAGE HANDLING
// ========================

// Better camera experience
async function openCamera() {
    try {
        showSnackbar('Requesting camera access...', 'info');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        
        const modal = document.getElementById('camera-modal');
        const video = document.getElementById('camera-view');
        
        video.srcObject = stream;
        modal.classList.remove('hidden');
        
        // Show camera instructions
        showCameraInstructions();
        
    } catch (error) {
        console.error('Camera error:', error);
        showSnackbar('Unable to access camera. Please check permissions.', 'error');
        
        // Fallback to file upload
        setTimeout(() => {
            document.getElementById('file-upload').click();
        }, 1000);
    }
}

function showCameraInstructions() {
    const instructions = `
        <div class="camera-instructions">
            <p><i class="fas fa-lightbulb"></i> Tips for better photos:</p>
            <ul>
                <li>Ensure good lighting</li>
                <li>Hold camera steady</li>
                <li>Get close to the issue</li>
                <li>Include location markers</li>
            </ul>
        </div>
    `;
    
    // Add instructions to camera modal
    const modalBody = document.querySelector('#camera-modal .modal-body');
    const existing = modalBody.querySelector('.camera-instructions');
    if (!existing) {
        const div = document.createElement('div');
        div.innerHTML = instructions;
        modalBody.appendChild(div.firstElementChild);
    }
}

// ========================
// IMPROVED DATA LOADING
// ========================

// Skeleton loading states
function showSkeletonLoader(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-loader';
        skeleton.innerHTML = `
            <div class="skeleton-header"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-footer"></div>
        `;
        container.appendChild(skeleton);
    }
}

// Progressive loading
async function loadReportsWithPagination() {
    showSkeletonLoader('reports-list', 3);
    
    try {
        const response = await fetch('/api/reports?page=1&limit=10');
        const data = await response.json();
        
        if (data.success) {
            displayReports(data.reports);
            
            // Setup infinite scroll
            setupInfiniteScroll();
        }
    } catch (error) {
        console.error('Failed to load reports:', error);
        showSnackbar('Failed to load reports', 'error');
    }
}

// ========================
// IMPROVED USER ONBOARDING
// ========================

// First-time user experience
function checkFirstTimeUser() {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    
    if (!hasSeenOnboarding && currentUser) {
        setTimeout(() => {
            showHelpModal();
            localStorage.setItem('hasSeenOnboarding', 'true');
        }, 1000);
    }
}

function showHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ========================
// IMPROVED OFFLINE SUPPORT
// ========================

// Cache reports for offline viewing
async function cacheReports() {
    if ('caches' in window) {
        const cache = await caches.open('bayan-reports-v1');
        const response = await fetch('/api/user_reports');
        await cache.put('/api/user_reports', response.clone());
    }
}

// Check network status
function setupNetworkStatusListener() {
    window.addEventListener('online', () => {
        showSnackbar('Back online. Syncing data...', 'success');
        syncOfflineReports();
    });
    
    window.addEventListener('offline', () => {
        showSnackbar('You are offline. Some features may be limited.', 'warning');
    });
}

// Sync offline reports
async function syncOfflineReports() {
    const offlineReports = JSON.parse(localStorage.getItem('offlineReports') || '[]');
    
    if (offlineReports.length > 0) {
        showSnackbar(`Syncing ${offlineReports.length} offline reports...`, 'info');
        
        for (const report of offlineReports) {
            try {
                await submitReport(report);
            } catch (error) {
                console.error('Failed to sync report:', error);
            }
        }
        
        localStorage.removeItem('offlineReports');
        showSnackbar('All reports synced successfully!', 'success');
    }
}

// ========================
// IMPROVED SEARCH & FILTER
// ========================

// Instant search functionality
function setupSearch() {
    const searchInput = document.getElementById('search-reports');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(() => {
            const query = e.target.value.trim();
            if (query.length >= 2 || query.length === 0) {
                searchReports(query);
            }
        }, 300);
    });
}

async function searchReports(query) {
    try {
        const response = await fetch(`/api/search_reports?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            displaySearchResults(data.results, query);
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}

// ========================
// IMPROVED ANALYTICS
// ========================

// Track user interactions (privacy-friendly)
function trackInteraction(event, details = {}) {
    const analyticsData = {
        event,
        timestamp: new Date().toISOString(),
        userId: currentUser?.id,
        userRole: currentUser?.role,
        ...details
    };
    
    // Store locally for analytics
    const interactions = JSON.parse(localStorage.getItem('userInteractions') || '[]');
    interactions.push(analyticsData);
    localStorage.setItem('userInteractions', JSON.stringify(interactions.slice(-100))); // Keep last 100
    
    // Optional: Send to server
    if (navigator.onLine) {
        fetch('/api/track_interaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(analyticsData)
        }).catch(console.error);
    }
}

// ========================
// IMPROVED INITIALIZATION
// ========================

// Enhanced app initialization
async function initializeApp() {
    console.log('🚀 Initializing BAYAN App...');
    
    try {
        // Show loading screen
        document.getElementById('loading-screen').classList.add('active');
        
        // Check authentication
        await checkAuthStatus();
        
        // Setup all event listeners
        setupEventListeners();
        
        // Setup network monitoring
        setupNetworkStatusListener();
        
        // Check for updates
        checkForAppUpdates();
        
        // Setup service worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
        
        // Check first-time user
        checkFirstTimeUser();
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showSnackbar('Failed to initialize app', 'error');
    } finally {
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.remove('active');
        }, 500);
    }
}

// Check for app updates
function checkForAppUpdates() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.update();
        });
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializeApp);


// ========================
// DARK MODE FUNCTIONALITY
// ========================

// Initialize dark mode
function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        console.log('🌙 Dark mode enabled');
    } else {
        document.body.classList.remove('dark-mode');
        console.log('☀️ Light mode enabled');
    }
    
    // Update toggle button state
    updateDarkModeToggle();
    
    // Listen for system preference changes
    listenForSystemDarkMode();
}

// Toggle dark mode
function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    
    // Save preference
    localStorage.setItem('darkMode', isDarkMode);
    
    // Update UI
    updateDarkModeToggle();
    
    // Show feedback
    showSnackbar(`Switched to ${isDarkMode ? 'dark' : 'light'} mode`, 'info');
    
    console.log(`🎨 Dark mode ${isDarkMode ? 'enabled' : 'disabled'}`);
}

// Update dark mode toggle button
function updateDarkModeToggle() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const toggleBtns = document.querySelectorAll('.dark-mode-toggle');
    
    toggleBtns.forEach(btn => {
        const moonIcon = btn.querySelector('.fa-moon');
        const sunIcon = btn.querySelector('.fa-sun');
        
        if (moonIcon && sunIcon) {
            moonIcon.style.opacity = isDarkMode ? '0' : '1';
            moonIcon.style.transform = isDarkMode ? 'rotate(-90deg)' : 'rotate(0deg)';
            sunIcon.style.opacity = isDarkMode ? '1' : '0';
            sunIcon.style.transform = isDarkMode ? 'rotate(0deg)' : 'rotate(90deg)';
        }
    });
}

// Listen for system dark mode preference
function listenForSystemDarkMode() {
    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Only auto-apply if user hasn't set a preference
        if (!localStorage.getItem('darkMode')) {
            if (mediaQuery.matches) {
                document.body.classList.add('dark-mode');
                updateDarkModeToggle();
            }
        }
        
        // Listen for changes
        mediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('darkMode')) {
                if (e.matches) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
                updateDarkModeToggle();
            }
        });
    }
}

// Add dark mode toggle to user dashboard
function addDarkModeToggleToUserDashboard() {
    const headerActions = document.querySelector('.dashboard-container .header-actions');
    if (!headerActions) return;
    
    // Check if toggle already exists
    if (!document.querySelector('.dashboard-container .dark-mode-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'dark-mode-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-moon"></i><i class="fas fa-sun"></i>';
        toggleBtn.title = 'Toggle dark mode';
        toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
        toggleBtn.onclick = toggleDarkMode;
        
        // Insert before notification button
        const notificationBtn = headerActions.querySelector('.icon-btn');
        if (notificationBtn) {
            headerActions.insertBefore(toggleBtn, notificationBtn);
        } else {
            headerActions.appendChild(toggleBtn);
        }
    }
}

// Add dark mode toggle to admin dashboard
function addDarkModeToggleToAdminDashboard() {
    const headerActions = document.querySelector('.admin-container .header-actions');
    if (!headerActions) return;
    
    // Check if toggle already exists
    if (!document.querySelector('.admin-container .dark-mode-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'dark-mode-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-moon"></i><i class="fas fa-sun"></i>';
        toggleBtn.title = 'Toggle dark mode';
        toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
        toggleBtn.onclick = toggleDarkMode;
        
        // Insert before notification button
        const notificationBtn = headerActions.querySelector('.icon-btn');
        if (notificationBtn) {
            headerActions.insertBefore(toggleBtn, notificationBtn);
        } else {
            headerActions.appendChild(toggleBtn);
        }
    }
}

// Update existing functions to include dark mode initialization:

// Update loadUserDashboard function:
async function loadUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('user-name').textContent = currentUser.username;
    await loadStats();
    await loadNotificationsCount();
    addDarkModeToggleToUserDashboard();
    initDarkMode(); // Initialize dark mode
}

// Update loadAdminDashboard function:
async function loadAdminDashboard() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const adminContainer = document.querySelector('.admin-container');
    adminContainer.innerHTML = `
        <div class="screen-header">
            <h2>Admin Dashboard</h2>
            <div class="header-actions">
                <button class="dark-mode-toggle" onclick="toggleDarkMode()" title="Toggle dark mode">
                    <i class="fas fa-moon"></i>
                    <i class="fas fa-sun"></i>
                </button>
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
                            Refresh
                        </button>
                        <button class="dropdown-item" onclick="toggleDarkMode()">
                            <i class="fas fa-moon"></i>
                            Toggle Dark Mode
                        </button>
                        <button class="dropdown-item" onclick="logout()">
                            <i class="fas fa-sign-out-alt"></i>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Rest of admin dashboard HTML remains the same -->
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
    await checkNewReportsNotification();
    await loadAdminNotificationsCount();
    addDarkModeToggleToAdminDashboard();
    initDarkMode(); // Initialize dark mode
}

// Update initializeApp function to include dark mode initialization
async function initializeApp() {
    console.log('🚀 Initializing BAYAN App...');
    
    try {
        // Show loading screen
        document.getElementById('loading-screen').classList.add('active');
        
        // Initialize dark mode first
        initDarkMode();
        
        // Check authentication
        await checkAuthStatus();
        
        // Setup all event listeners
        setupEventListeners();
        
        // Setup network monitoring
        setupNetworkStatusListener();
        
        // Check for updates
        checkForAppUpdates();
        
        // Setup service worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
        
        // Check first-time user
        checkFirstTimeUser();
        
    } catch (error) {
        console.error('App initialization failed:', error);
        showSnackbar('Failed to initialize app', 'error');
    } finally {
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.remove('active');
        }, 500);
    }
}

// Add keyboard shortcut for dark mode (Ctrl/Cmd + D)
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleDarkMode();
    }
});

// Add these functions to your existing script.js

// Enhanced showScreen function with animations
function showScreen(screenId) {
    const currentScreen = document.querySelector('.screen.active');
    const targetScreen = document.getElementById(screenId);
    
    if (!targetScreen) {
        console.error(`Screen ${screenId} not found`);
        return;
    }
    
    // Add fade out animation to current screen
    if (currentScreen && currentScreen !== targetScreen) {
        currentScreen.classList.add('animate-fade-out');
        setTimeout(() => {
            currentScreen.classList.remove('active', 'animate-fade-out');
            targetScreen.classList.add('active', 'animate-fade-in');
            setTimeout(() => {
                targetScreen.classList.remove('animate-fade-in');
            }, 300);
        }, 200);
    } else {
        targetScreen.classList.add('active', 'animate-fade-in');
        setTimeout(() => {
            targetScreen.classList.remove('animate-fade-in');
        }, 300);
    }
    
    // Special handling for specific screens
    switch(screenId) {
        case 'user-dashboard':
            loadDashboardStats();
            loadRecentReports();
            break;
        case 'my-reports-screen':
            loadMyReports();
            break;
        case 'notifications-screen':
            loadNotifications();
            break;
        case 'admin-dashboard':
            loadAdminDashboard();
            break;
    }
    
    // Close any open dropdowns
    closeAllDropdowns();
}

// Enhanced togglePassword function
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.parentElement.querySelector('i.fa-eye, i.fa-eye-slash');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Enhanced logout function
async function logout() {
    try {
        showToast('Logging out', 'Please wait...', 'info');
        
        const response = await fetch('/api/logout');
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            localStorage.clear();
            
            showToast('Logged out', 'You have been logged out successfully', 'success');
            
            // Animate logout
            const currentScreen = document.querySelector('.screen.active');
            if (currentScreen) {
                currentScreen.classList.add('animate-fade-out');
                setTimeout(() => {
                    currentScreen.classList.remove('active', 'animate-fade-out');
                    const loginScreen = document.getElementById('login-screen');
                    if (loginScreen) {
                        loginScreen.classList.add('active', 'animate-fade-in');
                        setTimeout(() => {
                            loginScreen.classList.remove('animate-fade-in');
                        }, 300);
                    }
                }, 200);
            }
        } else {
            showToast('Logout Failed', data.message || 'Unable to logout', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error', 'Failed to logout. Please try again.', 'error');
    }
}

// Enhanced loadStats function
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            
            // Update with animation
            animateCounter('user-reports-count', stats.my_reports || 0);
            animateCounter('user-pending-count', stats.pending || 0);
            animateCounter('user-inprogress-count', stats.in_progress || 0);
            animateCounter('user-resolved-count', stats.resolved || 0);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Animated counter function
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    
    const increment = targetValue > currentValue ? 1 : -1;
    let current = currentValue;
    
    const interval = setInterval(() => {
        current += increment;
        element.textContent = current;
        
        if (current === targetValue) {
            clearInterval(interval);
            element.classList.add('text-green-600');
            setTimeout(() => {
                element.classList.remove('text-green-600');
            }, 1000);
        }
    }, 50);
}

// Enhanced handleLogin with loading state
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showToast('Validation Error', 'Please fill in all fields', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Signing In...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showToast('Welcome!', `Hello ${currentUser.username}!`, 'success');
            
            // Animate transition to dashboard
            const loginScreen = document.getElementById('login-screen');
            loginScreen.classList.add('animate-fade-out');
            
            setTimeout(() => {
                loginScreen.classList.remove('active', 'animate-fade-out');
                
                if (currentUser.role === 'admin') {
                    const adminScreen = document.getElementById('admin-dashboard');
                    adminScreen.classList.add('active', 'animate-fade-in');
                    setTimeout(() => {
                        adminScreen.classList.remove('animate-fade-in');
                        loadAdminDashboard();
                    }, 300);
                } else {
                    const userScreen = document.getElementById('user-dashboard');
                    userScreen.classList.add('active', 'animate-fade-in');
                    setTimeout(() => {
                        userScreen.classList.remove('animate-fade-in');
                        loadDashboardStats();
                        loadRecentReports();
                        updateUserInitials();
                    }, 300);
                }
            }, 300);
        } else {
            showToast('Login Failed', data.message || 'Invalid credentials', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Error', 'Failed to login. Please try again.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Enhanced handleReportSubmit
async function handleReportSubmit(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showToast('Authentication Required', 'Please login first', 'error');
        return;
    }
    
    // Validate form
    if (!validateReportForm()) return;
    
    // Get form values
    const problemType = document.getElementById('problem-type').value;
    const location = document.getElementById('location').value;
    const issue = document.getElementById('issue').value;
    const priority = document.getElementById('priority').value;
    
    // Show loading
    const submitBtn = document.getElementById('submit-report-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Submitting...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/submit_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            showToast('Success!', 'Report submitted successfully', 'success');
            
            // Reset form with animation
            const form = document.getElementById('report-form');
            form.reset();
            removePhoto();
            
            // Animate success
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Submitted!';
            submitBtn.classList.add('bg-green-600');
            
            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.classList.remove('bg-green-600');
                submitBtn.disabled = false;
            }, 2000);
            
            // Refresh stats
            loadDashboardStats();
            loadRecentReports();
        } else {
            showToast('Submission Failed', data.message, 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Submit error:', error);
        showToast('Error', 'Failed to submit report', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Close all dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu:not(.hidden)').forEach(dropdown => {
        dropdown.classList.add('hidden');
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Setup click outside for dropdowns
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-container') && 
            !event.target.closest('.user-menu')) {
            closeAllDropdowns();
        }
    });
});


// enhanced-ui.js - Enhanced UI Functions

// Initialize Enhanced UI
function initEnhancedUI() {
    console.log('🚀 Initializing Enhanced UI...');
    
    // Setup problem type buttons
    setupProblemTypeButtons();
    
    // Setup form validation
    setupFormValidation();
    
    // Setup event listeners
    setupEnhancedEventListeners();
    
    // Initialize dark mode
    initDarkMode();
    
    // Load initial data if user is logged in
    if (window.currentUser) {
        updateUserInitials();
        loadDashboardStats();
        loadRecentReports();
    }
}

// Setup Problem Type Buttons
function setupProblemTypeButtons() {
    const buttons = document.querySelectorAll('.problem-type-btn');
    const hiddenInput = document.getElementById('problem-type');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update hidden input value
            if (hiddenInput) {
                hiddenInput.value = this.dataset.type;
            }
        });
    });
}

// Setup Enhanced Event Listeners
function setupEnhancedEventListeners() {
    // User menu toggle
    const userMenuBtn = document.querySelector('[onclick*="toggleUserMenu"]');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', toggleUserMenu);
    }
    
    // Search functionality
    const searchInput = document.getElementById('report-search');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            filterReports(e.target.value);
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('report-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function(e) {
            filterByStatus(e.target.value);
        });
    }
    
    // Pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (prevBtn) {
        prevBtn.addEventListener('click', goToPrevPage);
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', goToNextPage);
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.user-menu') && !event.target.closest('[onclick*="toggleUserMenu"]')) {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown && !dropdown.classList.contains('hidden')) {
                dropdown.classList.add('hidden');
            }
        }
    });
}

// Toggle User Menu
function toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Update User Initials
function updateUserInitials() {
    const user = window.currentUser;
    if (!user || !user.username) return;
    
    const initials = getInitials(user.username);
    
    document.querySelectorAll('#user-avatar, .user-avatar-large').forEach(el => {
        el.textContent = initials;
    });
    
    // Update user name in dropdown
    const dropdownName = document.getElementById('dropdown-user-name');
    const userName = document.getElementById('user-name');
    const welcomeName = document.getElementById('welcome-name');
    
    if (dropdownName) dropdownName.textContent = user.username;
    if (userName) userName.textContent = user.username;
    if (welcomeName) welcomeName.textContent = user.username.split(' ')[0];
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// Initialize Dark Mode
function initDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateDarkModeIcons(true);
    }
}

// Toggle Dark Mode
function toggleDarkMode() {
    const html = document.documentElement;
    const isDarkMode = html.getAttribute('data-theme') === 'dark';
    
    if (isDarkMode) {
        html.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'false');
        updateDarkModeIcons(false);
        showSnackbar('Light mode enabled', 'success');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'true');
        updateDarkModeIcons(true);
        showSnackbar('Dark mode enabled', 'success');
    }
}

// Update Dark Mode Icons
function updateDarkModeIcons(isDark) {
    document.querySelectorAll('.fa-moon, .fa-sun').forEach(icon => {
        if (icon.classList.contains('fa-moon')) {
            icon.style.display = isDark ? 'none' : 'inline-block';
        }
        if (icon.classList.contains('fa-sun')) {
            icon.style.display = isDark ? 'inline-block' : 'none';
        }
    });
}

// Load Dashboard Stats
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            
            // Update stats on dashboard
            const elements = {
                'user-reports-count': stats.my_reports || 0,
                'user-pending-count': stats.pending || 0,
                'user-inprogress-count': stats.in_progress || 0,
                'user-resolved-count': stats.resolved || 0
            };
            
            for (const [id, value] of Object.entries(elements)) {
                const element = document.getElementById(id);
                if (element) {
                    animateCounter(element, value);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

// Animated Counter
function animateCounter(element, targetValue) {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    
    const increment = targetValue > currentValue ? 1 : -1;
    let current = currentValue;
    
    const interval = setInterval(() => {
        current += increment;
        element.textContent = current;
        
        if (current === targetValue) {
            clearInterval(interval);
        }
    }, 50);
}

// Load Recent Reports
async function loadRecentReports() {
    try {
        const container = document.getElementById('recent-reports-list');
        if (!container) return;
        
        const response = await fetch('/api/user_reports?limit=5');
        const data = await response.json();
        
        if (data.success && data.reports.length > 0) {
            container.innerHTML = data.reports.map(report => `
                <div class="recent-report-item">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center ${getReportTypeColor(report.problem_type)}">
                            <i class="fas ${getReportTypeIcon(report.problem_type)}"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="font-medium truncate">${report.problem_type}</p>
                            <span class="report-status-badge report-status-${report.status.toLowerCase().replace(' ', '-')}">
                                ${report.status}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500 truncate">${report.location}</p>
                        <p class="text-xs text-gray-400">${formatDate(report.date)}</p>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load recent reports:', error);
    }
}

// Helper Functions
function getReportTypeIcon(type) {
    const icons = {
        'Pothole': 'fa-road',
        'Garbage': 'fa-trash',
        'Light': 'fa-lightbulb',
        'Water': 'fa-tint',
        'Noise': 'fa-volume-up',
        'Other': 'fa-ellipsis-h'
    };
    return icons[type] || 'fa-file-alt';
}

function getReportTypeColor(type) {
    const colors = {
        'Pothole': 'bg-orange-100 text-orange-600',
        'Garbage': 'bg-red-100 text-red-600',
        'Light': 'bg-yellow-100 text-yellow-600',
        'Water': 'bg-blue-100 text-blue-600',
        'Noise': 'bg-purple-100 text-purple-600',
        'Other': 'bg-gray-100 text-gray-600'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
}

// Filter Reports
function filterReports(searchTerm) {
    const rows = document.querySelectorAll('#reports-table-body tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const isVisible = text.includes(searchTerm.toLowerCase());
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });
    
    // Show/hide empty state
    const emptyState = document.getElementById('empty-reports-state');
    if (emptyState) {
        emptyState.classList.toggle('hidden', visibleCount > 0);
    }
}

// Filter by Status
function filterByStatus(status) {
    const rows = document.querySelectorAll('#reports-table-body tr');
    
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
            return;
        }
        
        const statusCell = row.querySelector('.report-status-badge');
        if (statusCell) {
            const rowStatus = statusCell.textContent.toLowerCase().replace(' ', '-');
            row.style.display = rowStatus === status ? '' : 'none';
        }
    });
}

// Pagination
let currentPage = 1;
const itemsPerPage = 10;

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadReports();
    }
}

function goToNextPage() {
    currentPage++;
    loadReports();
}

// Setup Form Validation
function setupFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                showSnackbar('Please fill in all required fields correctly', 'error');
            }
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const requiredInputs = form.querySelectorAll('[required]');
    
    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            markInvalid(input, 'This field is required');
            isValid = false;
        } else {
            markValid(input);
        }
    });
    
    return isValid;
}

function markInvalid(input, message) {
    input.classList.add('border-red-500');
    input.classList.remove('border-gray-300');
    
    // Remove existing error
    let error = input.parentElement.querySelector('.error-message');
    if (error) error.remove();
    
    // Add error message
    error = document.createElement('div');
    error.className = 'error-message text-sm text-red-600 mt-1';
    error.textContent = message;
    input.parentElement.appendChild(error);
}

function markValid(input) {
    input.classList.remove('border-red-500');
    input.classList.add('border-gray-300');
    
    // Remove error message
    const error = input.parentElement.querySelector('.error-message');
    if (error) error.remove();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for other scripts to load
    setTimeout(initEnhancedUI, 100);
});

// Export functions for global use
window.toggleDarkMode = toggleDarkMode;
window.updateUserInitials = updateUserInitials;
window.loadDashboardStats = loadDashboardStats;
window.loadRecentReports = loadRecentReports;



        // ==================== GLOBAL VARIABLES ====================
        let currentUser = null;
        let photoData = null;
        let cameraStream = null;
        let isFrontCamera = false;
        let currentReportId = null;
        
        // ==================== INITIALIZATION ====================
        document.addEventListener('DOMContentLoaded', function() {
            console.log('BAYAN App Initializing...');
            
            // Initialize UI
            initDarkMode();
            setupEventListeners();
            checkAuthStatus();
            checkFirstTimeUser();
            
            // Setup service worker for PWA
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('Service Worker registered');
                    })
                    .catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
            }
            
            // Hide loading screen after 1.5 seconds
            setTimeout(() => {
                hideLoadingScreen();
            }, 1500);
        });
        
        // ==================== UI FUNCTIONS ====================
        function hideLoadingScreen() {
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('hidden');
        }
        
        function showScreen(screenId) {
            // Hide all screens
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
            });
            
            // Show target screen
            const targetScreen = document.getElementById(screenId);
            if (targetScreen) {
                targetScreen.classList.add('active');
                
                // Update page title
                const titles = {
                    'login-screen': 'Login - BAYAN',
                    'register-screen': 'Sign Up - BAYAN',
                    'user-dashboard': 'Dashboard - BAYAN',
                    'my-reports-screen': 'My Reports - BAYAN',
                    'notifications-screen': 'Notifications - BAYAN',
                    'settings-screen': 'Settings - BAYAN',
                    'admin-dashboard': 'Admin Dashboard - BAYAN'
                };
                
                document.title = titles[screenId] || 'BAYAN';
                
                // Scroll to top
                window.scrollTo(0, 0);
            }
        }
        
        function showSnackbar(message, type = 'info', duration = 4000) {
            const snackbar = document.getElementById('snackbar');
            const messageEl = snackbar.querySelector('.snackbar-message');
            const iconEl = snackbar.querySelector('.snackbar-icon');
            
            // Set message and icon
            messageEl.textContent = message;
            
            // Set icon based on type
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            iconEl.className = `snackbar-icon fas ${icons[type] || icons.info}`;
            
            // Set type class
            snackbar.className = 'snackbar';
            snackbar.classList.add(type);
            
            // Show snackbar
            snackbar.classList.add('active');
            
            // Auto-hide
            setTimeout(() => {
                snackbar.classList.remove('active');
            }, duration);
        }
        
        function togglePassword(inputId) {
            const input = document.getElementById(inputId);
            const icon = input.parentElement.querySelector('.toggle-password i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
        
        // ==================== DARK MODE ====================
        function initDarkMode() {
            const isDarkMode = localStorage.getItem('darkMode') === 'true';
            
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
                document.querySelectorAll('.dark-mode-toggle').forEach(toggle => {
                    toggle.classList.add('active');
                });
            }
        }
        
        function toggleDarkMode() {
            const isDarkMode = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDarkMode);
            
            // Update toggle buttons
            document.querySelectorAll('.dark-mode-toggle').forEach(toggle => {
                toggle.classList.toggle('active');
            });
            
            showSnackbar(
                isDarkMode ? 'Dark mode enabled' : 'Light mode enabled',
                'success'
            );
        }
        
        // ==================== USER MENU ====================
        function toggleUserMenu() {
            const dropdown = document.getElementById('user-dropdown');
            dropdown.classList.toggle('active');
        }
        
        function toggleAdminMenu() {
            const dropdown = document.getElementById('admin-dropdown');
            dropdown.classList.toggle('active');
        }
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.user-menu') && !event.target.closest('.dropdown-menu')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });
        
        // ==================== MODAL FUNCTIONS ====================
        function showModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
            }
        }
        
        function hideModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('active');
            }
        }
        
        function showHelpModal() {
            showModal('help-modal');
        }
        
        function closeHelpModal() {
            hideModal('help-modal');
        }
        
        function skipOnboarding() {
            localStorage.setItem('hasSeenOnboarding', 'true');
            hideModal('help-modal');
            showSnackbar('You can always access help from the user menu', 'info');
        }
        
        // ==================== CAMERA FUNCTIONS ====================
        async function openCamera() {
            try {
                const constraints = {
                    video: {
                        facingMode: isFrontCamera ? 'user' : 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                
                cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                const video = document.getElementById('camera-view');
                video.srcObject = cameraStream;
                
                showModal('camera-modal');
            } catch (error) {
                console.error('Camera error:', error);
                showSnackbar('Unable to access camera. Please check permissions.', 'error');
            }
        }
        
        function closeCamera() {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            
            const video = document.getElementById('camera-view');
            video.srcObject = null;
            
            hideModal('camera-modal');
        }
        
        function switchCamera() {
            isFrontCamera = !isFrontCamera;
            closeCamera();
            setTimeout(openCamera, 100);
        }
        
        function capturePhoto() {
            const video = document.getElementById('camera-view');
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            photoData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Show preview
            const preview = document.getElementById('photo-preview');
            const previewImage = document.getElementById('preview-image');
            
            previewImage.src = photoData;
            preview.classList.remove('hidden');
            
            closeCamera();
            showSnackbar('Photo captured successfully!', 'success');
        }
        
        function handleFileUpload(file) {
            if (!file || !file.type.startsWith('image/')) {
                showSnackbar('Please select a valid image file', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) {
                showSnackbar('Image size should be less than 5MB', 'error');
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
                
                showSnackbar('Photo uploaded successfully!', 'success');
            };
            reader.readAsDataURL(file);
        }
        
        function removePhoto() {
            photoData = null;
            document.getElementById('photo-preview').classList.add('hidden');
        }
        
        // ==================== LOCATION FUNCTIONS ====================
        function getCurrentLocation() {
            if (navigator.geolocation) {
                showSnackbar('Getting your location...', 'info');
                
                navigator.geolocation.getCurrentPosition(
                    position => {
                        const { latitude, longitude } = position.coords;
                        
                        // Reverse geocode to get address
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
                            .then(response => response.json())
                            .then(data => {
                                const address = data.display_name || `${latitude}, ${longitude}`;
                                document.getElementById('location').value = address;
                                showSnackbar('Location updated!', 'success');
                            })
                            .catch(error => {
                                console.error('Geocoding error:', error);
                                document.getElementById('location').value = `${latitude}, ${longitude}`;
                                showSnackbar('Location updated (coordinates only)', 'success');
                            });
                    },
                    error => {
                        console.error('Geolocation error:', error);
                        showSnackbar('Unable to get location. Please enter manually.', 'error');
                    }
                );
            } else {
                showSnackbar('Geolocation is not supported by your browser', 'error');
            }
        }
        
        // ==================== FORM HANDLING ====================
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
                reportForm.addEventListener('submit', handleReportSubmit);
            }
            
            // Close modals on escape key
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    document.querySelectorAll('.modal.active').forEach(modal => {
                        modal.classList.remove('active');
                    });
                }
            });
        }
        
        async function handleLogin(e) {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showSnackbar('Please fill in all fields', 'error');
                return;
            }
            
            try {
                showSnackbar('Signing in...', 'info');
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // For demo purposes - replace with actual API call
                currentUser = {
                    id: 1,
                    username: 'John Doe',
                    email: email,
                    role: email.includes('admin') ? 'admin' : 'user'
                };
                
                // Update UI
                document.getElementById('user-name').textContent = `Welcome, ${currentUser.username}!`;
                document.getElementById('user-avatar-text').textContent = currentUser.username.charAt(0).toUpperCase();
                
                if (currentUser.role === 'admin') {
                    showScreen('admin-dashboard');
                    loadAdminDashboard();
                } else {
                    showScreen('user-dashboard');
                    loadUserDashboard();
                }
                
                showSnackbar('Login successful!', 'success');
                
            } catch (error) {
                console.error('Login error:', error);
                showSnackbar('Login failed. Please try again.', 'error');
            }
        }
        
        async function handleRegister(e) {
            e.preventDefault();
            
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
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
                showSnackbar('Creating account...', 'info');
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                showScreen('login-screen');
                showSnackbar('Account created successfully! Please sign in.', 'success');
                
                // Clear form
                document.getElementById('register-form').reset();
                
            } catch (error) {
                console.error('Registration error:', error);
                showSnackbar('Registration failed. Please try again.', 'error');
            }
        }
        
        async function handleReportSubmit(e) {
            e.preventDefault();
            
            if (!currentUser) {
                showSnackbar('Please login first', 'error');
                return;
            }
            
            const problemType = document.getElementById('problem-type').value;
            const location = document.getElementById('location').value;
            const issue = document.getElementById('issue').value;
            const priority = document.getElementById('priority').value;
            
            if (!problemType || !location || !issue) {
                showSnackbar('Please fill in all required fields', 'error');
                return;
            }
            
            try {
                const submitBtn = document.querySelector('#report-form button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                submitBtn.disabled = true;
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Reset form
                document.getElementById('report-form').reset();
                removePhoto();
                
                // Update stats
                const reportsCount = document.getElementById('user-reports-count');
                reportsCount.textContent = parseInt(reportsCount.textContent) + 1;
                
                showSnackbar('Report submitted successfully!', 'success');
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                
            } catch (error) {
                console.error('Report submission error:', error);
                showSnackbar('Failed to submit report. Please try again.', 'error');
            }
        }
        
        // ==================== DASHBOARD FUNCTIONS ====================
        async function loadUserDashboard() {
            // Load user stats
            document.getElementById('user-reports-count').textContent = '12';
            document.getElementById('user-pending-count').textContent = '3';
            document.getElementById('user-resolved-count').textContent = '9';
            document.getElementById('user-rating').textContent = '4.8';
        }
        
        async function loadAdminDashboard() {
            // Load admin stats
            document.getElementById('total-reports').textContent = '156';
            document.getElementById('pending-reports').textContent = '24';
            document.getElementById('in-progress-reports').textContent = '18';
            document.getElementById('resolved-reports').textContent = '114';
            document.getElementById('today-reports').textContent = '8';
            document.getElementById('response-time').textContent = '24h';
            
            // Load sample reports
            loadSampleReports();
        }
        
        function loadSampleReports() {
            const reportsList = document.getElementById('admin-reports-list');
            
            const sampleReports = [
                {
                    id: 1,
                    type: 'Pothole',
                    location: 'Main Street, Barangay 123',
                    issue: 'Large pothole causing traffic issues',
                    status: 'pending',
                    priority: 'high',
                    date: 'Today, 10:30 AM',
                    user: 'Juan Dela Cruz'
                },
                {
                    id: 2,
                    type: 'Garbage Collection',
                    location: 'Side Street, Barangay 456',
                    issue: 'Garbage not collected for 3 days',
                    status: 'in-progress',
                    priority: 'medium',
                    date: 'Yesterday, 2:15 PM',
                    user: 'Maria Santos'
                },
                {
                    id: 3,
                    type: 'Street Light',
                    location: 'Park Avenue, Barangay 789',
                    issue: 'Street light not working',
                    status: 'resolved',
                    priority: 'low',
                    date: '2 days ago, 9:00 AM',
                    user: 'Pedro Reyes'
                }
            ];
            
            reportsList.innerHTML = sampleReports.map(report => `
                <div class="report-card">
                    <div class="report-header">
                        <div class="report-type">${report.type}</div>
                        <span class="report-status status-${report.status}">
                            ${report.status.replace('-', ' ').toUpperCase()}
                        </span>
                    </div>
                    <div class="report-location">
                        <i class="fas fa-location-dot"></i> ${report.location}
                    </div>
                    <div class="report-issue">${report.issue}</div>
                    <div class="report-footer">
                        <div class="report-date">
                            <i class="fas fa-clock"></i> ${report.date}
                        </div>
                        <div class="report-priority">${report.priority.toUpperCase()}</div>
                    </div>
                    <div class="mt-3 flex gap-2">
                        <select class="form-select" onchange="handleStatusChange(${report.id}, this.value)">
                            <option value="pending" ${report.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in-progress" ${report.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                            <option value="resolved" ${report.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <button class="btn btn-danger" onclick="deleteReport(${report.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        // ==================== REPORT FUNCTIONS ====================
        function showMyReports() {
            showScreen('my-reports-screen');
            // Load user's reports here
        }
        
        function showNotifications() {
            showScreen('notifications-screen');
            // Load notifications here
        }
        
        function markAllAsRead() {
            document.querySelectorAll('.notification-badge').forEach(badge => {
                badge.classList.add('hidden');
            });
            showSnackbar('All notifications marked as read', 'success');
        }
        
        function filterMyReports(filter) {
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            // Implement filtering logic here
        }
        
        function filterReports(timeframe) {
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            // Implement filtering logic here
        }
        
        function filterByStatus(status) {
            // Implement status filtering
        }
        
        function filterByPriority(priority) {
            // Implement priority filtering
        }
        
        function handleStatusChange(reportId, status) {
            if (status === 'resolved') {
                currentReportId = reportId;
                showModal('resolution-modal');
            } else {
                showSnackbar(`Status updated to ${status}`, 'success');
            }
        }
        
        function submitResolution() {
            const auditorName = document.getElementById('auditor-name').value;
            const resolutionNotes = document.getElementById('resolution-notes').value;
            
            if (!auditorName || !resolutionNotes) {
                showSnackbar('Please fill in all fields', 'error');
                return;
            }
            
            hideModal('resolution-modal');
            showSnackbar('Resolution submitted successfully', 'success');
            
            // Clear form
            document.getElementById('auditor-name').value = '';
            document.getElementById('resolution-notes').value = '';
        }
        
        function cancelResolution() {
            hideModal('resolution-modal');
            
            // Reset status to previous value
            showSnackbar('Resolution cancelled', 'info');
        }
        
        function deleteReport(reportId) {
            if (confirm('Are you sure you want to delete this report?')) {
                showSnackbar('Report deleted', 'success');
            }
        }
        
        // ==================== ADMIN FUNCTIONS ====================
        function refreshAdminDashboard() {
            showSnackbar('Dashboard refreshed', 'success');
        }
        
        function showAnalytics() {
            showModal('analytics-modal');
        }
        
        function closeAnalytics() {
            hideModal('analytics-modal');
        }
        
        function showAdminNotifications() {
            showSnackbar('Showing admin notifications', 'info');
        }
        
        // ==================== AUTH FUNCTIONS ====================
        async function checkAuthStatus() {
            // Simulate auth check
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // For demo - always show login screen
            showScreen('login-screen');
        }
        
        function checkFirstTimeUser() {
            const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
            if (!hasSeenOnboarding && currentUser) {
                setTimeout(showHelpModal, 1000);
            }
        }
        
        function logout() {
            currentUser = null;
            showScreen('login-screen');
            showSnackbar('Logged out successfully', 'success');
        }
        
        // ==================== UTILITY FUNCTIONS ====================
        // Make functions available globally
        window.showScreen = showScreen;
        window.togglePassword = togglePassword;
        window.toggleDarkMode = toggleDarkMode;
        window.openCamera = openCamera;
        window.closeCamera = closeCamera;
        window.capturePhoto = capturePhoto;
        window.switchCamera = switchCamera;
        window.handleFileUpload = handleFileUpload;
        window.removePhoto = removePhoto;
        window.getCurrentLocation = getCurrentLocation;
        window.showMyReports = showMyReports;
        window.showNotifications = showNotifications;
        window.markAllAsRead = markAllAsRead;
        window.filterMyReports = filterMyReports;
        window.filterReports = filterReports;
        window.filterByStatus = filterByStatus;
        window.filterByPriority = filterByPriority;
        window.handleStatusChange = handleStatusChange;
        window.submitResolution = submitResolution;
        window.cancelResolution = cancelResolution;
        window.deleteReport = deleteReport;
        window.toggleUserMenu = toggleUserMenu;
        window.toggleAdminMenu = toggleAdminMenu;
        window.showHelpModal = showHelpModal;
        window.closeHelpModal = closeHelpModal;
        window.skipOnboarding = skipOnboarding;
        window.refreshAdminDashboard = refreshAdminDashboard;
        window.showAnalytics = showAnalytics;
        window.closeAnalytics = closeAnalytics;
        window.showAdminNotifications = showAdminNotifications;
        window.logout = logout;
    

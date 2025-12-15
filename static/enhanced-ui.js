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

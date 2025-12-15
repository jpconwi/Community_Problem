// final-integration.js - Integration between old and new UI

// Wait for DOM and other scripts to load
window.addEventListener('load', function() {
    console.log('🔄 Integrating enhanced UI...');
    
    // Check if we should use enhanced UI
    const useEnhancedUI = localStorage.getItem('useEnhancedUI') !== 'false';
    
    if (useEnhancedUI) {
        integrateEnhancedUI();
    } else {
        console.log('Using original UI');
    }
    
    // Add enhancement toggle (for testing)
    addEnhancementToggle();
});

function integrateEnhancedUI() {
    // 1. Replace login screen if enhanced version exists
    const enhancedLogin = document.getElementById('enhanced-login-screen');
    const originalLogin = document.getElementById('login-screen');
    
    if (enhancedLogin && originalLogin) {
        originalLogin.parentNode.replaceChild(enhancedLogin, originalLogin);
        console.log('✅ Enhanced login screen activated');
    }
    
    // 2. Replace user dashboard if enhanced version exists
    const enhancedDashboard = document.getElementById('enhanced-user-dashboard');
    const originalDashboard = document.getElementById('user-dashboard');
    
    if (enhancedDashboard && originalDashboard) {
        originalDashboard.parentNode.replaceChild(enhancedDashboard, originalDashboard);
        console.log('✅ Enhanced user dashboard activated');
    }
    
    // 3. Update event listeners for enhanced UI
    updateEventListeners();
    
    // 4. Initialize animations
    initAnimations();
}

function updateEventListeners() {
    // Update login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.removeEventListener('submit', handleLogin);
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Update register form submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.removeEventListener('submit', handleRegister);
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Update report form submit
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.removeEventListener('submit', handleReportSubmit);
        reportForm.addEventListener('submit', handleReportSubmit);
    }
}

function initAnimations() {
    // Add scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, observerOptions);
    
    // Observe scroll-reveal elements
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        observer.observe(el);
    });
    
    // Add hover effects
    document.querySelectorAll('.hover-lift').forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.classList.add('hover-lift');
        });
    });
}

function addEnhancementToggle() {
    // Only add in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const toggle = document.createElement('div');
        toggle.style.position = 'fixed';
        toggle.style.bottom = '20px';
        toggle.style.right = '20px';
        toggle.style.zIndex = '9999';
        toggle.innerHTML = `
            <button id="ui-toggle" style="background: #3b82f6; color: white; padding: 10px 15px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold;">
                Toggle Enhanced UI
            </button>
        `;
        document.body.appendChild(toggle);
        
        document.getElementById('ui-toggle').addEventListener('click', function() {
            const current = localStorage.getItem('useEnhancedUI');
            const newValue = current === 'false' ? 'true' : 'false';
            localStorage.setItem('useEnhancedUI', newValue);
            location.reload();
        });
    }
}

// Handle back button with animation
window.addEventListener('popstate', function() {
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.add('animate-fade-out');
        setTimeout(() => {
            currentScreen.classList.remove('active', 'animate-fade-out');
            // Handle back navigation logic
        }, 200);
    }
});

// Export functions for global use
window.toggleDarkMode = toggleDarkMode;
window.showToast = showToast;
window.animateCounter = animateCounter;

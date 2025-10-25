from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import base64
import os
import re
from flask_cors import CORS
from PIL import Image
import io

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-2024')
CORS(app)

# Database configuration for Render PostgreSQL
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://communitycare_user:3YInYGOvAJr8QvR0UxpMFP2aTapzHaHs@dpg-d3u5itn5r7bs73f91rrg-a/communitycare')

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_recycle': 300,
    'pool_pre_ping': True
}

db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reports = db.relationship('Report', backref='reporter', lazy=True)
    notifications = db.relationship('Notification', backref='user', lazy=True)

class Report(db.Model):
    __tablename__ = 'reports'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    problem_type = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    issue = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='Pending')
    priority = db.Column(db.String(20), default='Medium')
    photo_data = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notifications = db.relationship('Notification', backref='report', lazy=True)

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    report_id = db.Column(db.Integer, db.ForeignKey('reports.id'))
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='status_update')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AdminLog(db.Model):
    __tablename__ = 'admin_logs'
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    admin = db.relationship('User', backref='admin_logs')

# Initialize database on first request
@app.before_request
def initialize_database():
    try:
        if not hasattr(app, 'db_initialized'):
            db.create_all()
            
            # Create admin user if not exists
            admin = User.query.filter_by(email='admin@community.com').first()
            if not admin:
                admin = User(
                    username='admin',
                    password=generate_password_hash('admin123'),
                    email='admin@community.com',
                    role='admin'
                )
                db.session.add(admin)
                db.session.commit()
                print("✅ Database initialized successfully!")
            
            app.db_initialized = True
    except Exception as e:
        print(f"❌ Database initialization error: {e}")

# Helper functions
def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    if not phone:
        return True
    pattern = r'^\+?1?\d{9,15}$'
    return re.match(pattern, phone) is not None

def optimize_image(image_data, max_size=(800, 600), quality=85):
    try:
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='JPEG', quality=quality, optimize=True)
        
        optimized_data = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{optimized_data}"
    except Exception as e:
        print(f"Image optimization error: {e}")
        return image_data

def add_notification(user_id, report_id, message, notification_type="status_update"):
    try:
        notification = Notification(
            user_id=user_id,
            report_id=report_id,
            message=message,
            type=notification_type
        )
        db.session.add(notification)
        db.session.commit()
    except Exception as e:
        print(f"Notification error: {e}")

def add_admin_log(admin_id, action, target_type, target_id=None, details=None):
    try:
        log = AdminLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"Admin log error: {e}")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password, password):
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role
            session['email'] = user.email
            
            return jsonify({
                'success': True,
                'message': f'Welcome back, {user.username}!',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'role': user.role,
                    'email': user.email
                }
            })
        
        return jsonify({
            'success': False,
            'message': 'Invalid email or password!'
        })
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({
            'success': False,
            'message': 'Login failed. Please try again.'
        })

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        phone = data.get('phone')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if not all([username, email, password, confirm_password]):
            return jsonify({'success': False, 'message': 'Please fill in all required fields!'})
        
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Please enter a valid email address!'})
        
        if phone and not validate_phone(phone):
            return jsonify({'success': False, 'message': 'Please enter a valid phone number!'})
        
        if password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match!'})
        
        if len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters long!'})
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists!'})
        
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists!'})
        
        new_user = User(
            username=username,
            email=email,
            phone=phone,
            password=generate_password_hash(password)
        )
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Account created successfully!'
        })
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'success': False, 'message': 'Error creating account!'})

@app.route('/api/submit_report', methods=['POST'])
def submit_report():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        data = request.get_json()
        
        photo_data = data.get('photo_data')
        if photo_data:
            try:
                photo_data = optimize_image(photo_data)
            except Exception as e:
                print(f"Photo optimization failed: {e}")
        
        report = Report(
            user_id=session['user_id'],
            name=session['username'],
            problem_type=data.get('problem_type'),
            location=data.get('location'),
            issue=data.get('issue'),
            date=datetime.now().strftime("%Y-%m-%d %H:%M"),
            priority=data.get('priority', 'Medium'),
            photo_data=photo_data
        )
        
        db.session.add(report)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Report submitted successfully!'
        })
    except Exception as e:
        print(f"Report submission error: {e}")
        return jsonify({'success': False, 'message': 'Failed to submit report. Please try again.'})

@app.route('/api/user_reports')
def get_user_reports():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        reports = Report.query.filter_by(user_id=session['user_id']).order_by(Report.id.desc()).all()
        
        reports_data = []
        for report in reports:
            reports_data.append({
                'id': report.id,
                'problem_type': report.problem_type,
                'location': report.location,
                'issue': report.issue,
                'date': report.date,
                'status': report.status,
                'priority': report.priority,
                'photo_data': report.photo_data,
                'created_at': report.created_at.strftime("%Y-%m-%d %H:%M")
            })
        
        return jsonify({'success': True, 'reports': reports_data})
    except Exception as e:
        print(f"Get user reports error: {e}")
        return jsonify({'success': False, 'message': 'Failed to load reports.'})

@app.route('/api/all_reports')
def get_all_reports():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized!'})
    
    try:
        reports = db.session.execute(text("""
            SELECT r.*, u.username 
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.id DESC
        """)).mappings().all()
        
        reports_data = []
        for report in reports:
            reports_data.append(dict(report))
        
        return jsonify({'success': True, 'reports': reports_data})
    except Exception as e:
        print(f"Get all reports error: {e}")
        return jsonify({'success': False, 'message': 'Failed to load reports.'})

@app.route('/api/update_report_status', methods=['POST'])
def update_report_status():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized!'})
    
    try:
        data = request.get_json()
        report_id = data.get('report_id')
        new_status = data.get('status')
        
        report = Report.query.get(report_id)
        if report:
            report.status = new_status
            db.session.commit()
            
            add_notification(
                report.user_id,
                report_id,
                f"Your report status has been updated to {new_status}"
            )
            
            add_admin_log(
                session['user_id'],
                'UPDATE_STATUS',
                'report',
                report_id,
                f"Status changed to {new_status}"
            )
            
            return jsonify({'success': True, 'message': f'Status updated to {new_status}!'})
        
        return jsonify({'success': False, 'message': 'Report not found!'})
    except Exception as e:
        print(f"Update status error: {e}")
        return jsonify({'success': False, 'message': 'Failed to update status.'})

@app.route('/api/notifications')
def get_notifications():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        notifications = Notification.query.filter_by(user_id=session['user_id']).order_by(Notification.created_at.desc()).all()
        
        notifications_data = []
        for notification in notifications:
            notifications_data.append({
                'message': notification.message,
                'created_at': notification.created_at.strftime("%Y-%m-%d %H:%M"),
                'is_read': notification.is_read
            })
        
        Notification.query.filter_by(user_id=session['user_id']).update({'is_read': True})
        db.session.commit()
        
        return jsonify({'success': True, 'notifications': notifications_data})
    except Exception as e:
        print(f"Get notifications error: {e}")
        return jsonify({'success': False, 'message': 'Failed to load notifications.'})

@app.route('/api/notifications_count')
def get_notifications_count():
    if 'user_id' not in session:
        return jsonify({'count': 0})
    
    try:
        count = Notification.query.filter_by(user_id=session['user_id'], is_read=False).count()
        return jsonify({'count': count})
    except Exception as e:
        print(f"Notifications count error: {e}")
        return jsonify({'count': 0})

@app.route('/api/stats')
def get_stats():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Please login first!'})
    
    try:
        total = Report.query.count()
        pending = Report.query.filter_by(status='Pending').count()
        in_progress = Report.query.filter_by(status='In Progress').count()
        resolved = Report.query.filter_by(status='Resolved').count()
        
        if session.get('role') == 'admin':
            my_reports = total
        else:
            my_reports = Report.query.filter_by(user_id=session['user_id']).count()
        
        return jsonify({
            'success': True,
            'stats': {
                'total': total,
                'pending': pending,
                'in_progress': in_progress,
                'resolved': resolved,
                'my_reports': my_reports
            }
        })
    except Exception as e:
        print(f"Get stats error: {e}")
        return jsonify({'success': False, 'message': 'Failed to load statistics.'})

@app.route('/api/users')
def get_users():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized!'})
    
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        
        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'phone': user.phone,
                'role': user.role,
                'created_at': user.created_at.strftime("%Y-%m-%d %H:%M")
            })
        
        return jsonify({'success': True, 'users': users_data})
    except Exception as e:
        print(f"Get users error: {e}")
        return jsonify({'success': False, 'message': 'Failed to load users.'})

@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully!'})

@app.route('/api/user_info')
def get_user_info():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    return jsonify({
        'success': True,
        'user': {
            'id': session.get('user_id'),
            'username': session.get('username'),
            'role': session.get('role'),
            'email': session.get('email')
        }
    })

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

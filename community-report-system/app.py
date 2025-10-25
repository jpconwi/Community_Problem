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
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or 'sqlite:///community_reports.db'
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
    photo_data = db.Column(db.Text)  # Store base64 encoded image
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

# Initialize database
@app.before_first_request
def create_tables():
    try:
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
            print("Database initialized successfully!")
    except Exception as e:
        print(f"Database initialization error: {e}")

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
    """
    Optimize image size and quality for web display
    """
    try:
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        
        # Open image with PIL
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        # Resize image if larger than max_size
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save optimized image to bytes
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='JPEG', quality=quality, optimize=True)
        
        # Convert back to base64
        optimized_data = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        
        return f"data:image/jpeg;base64,{optimized_data}"
    except Exception as e:
        print(f"Image optimization error: {e}")
        return image_data  # Return original if optimization fails

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
        db.session.rollback()

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
        db.session.rollback()

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
        return jsonify({
            'success': False,
            'message': 'Login failed. Please try again.'
        })

# ... [Keep all your other routes the same] ...

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
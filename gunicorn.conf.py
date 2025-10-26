# gunicorn.conf.py
import multiprocessing

# Worker configuration - VERY conservative for free tier
workers = 1
worker_class = "sync"
worker_connections = 500  # Reduced
timeout = 30  # Reduced from 120
keepalive = 2

# Memory optimization
max_requests = 500  # Restart workers more frequently
max_requests_jitter = 50
preload_app = True

# Limit request size to prevent large uploads
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Server socket
bind = "0.0.0.0:10000"

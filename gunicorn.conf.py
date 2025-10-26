# gunicorn.conf.py
import multiprocessing

# Worker configuration
workers = 1  # Reduce workers on free tier
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 2

# Memory optimization
max_requests = 1000
max_requests_jitter = 100
preload_app = True  # Preload app to save memory

# Server socket
bind = "0.0.0.0:10000"

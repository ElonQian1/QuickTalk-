@echo off
echo Starting Rust Backend Server...
cd /d "%~dp0\backend"
set DATABASE_URL=sqlite:customer_service.db
set JWT_SECRET=your-super-secret-jwt-key
set SERVER_HOST=0.0.0.0
set SERVER_PORT=8080
cargo run
pause
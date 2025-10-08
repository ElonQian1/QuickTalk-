@echo off
cd /d "E:\duihua\customer-service-system\backend"
set DATABASE_URL=sqlite:customer_service.db
set JWT_SECRET=your-super-secret-jwt-key
set SERVER_HOST=0.0.0.0
set SERVER_PORT=8080
customer-service-production.exe
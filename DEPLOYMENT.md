# Digital Heroes Deployment Guide

## 1. Prerequisites
- Node.js 20+ on local machine and deployment platforms
- MongoDB database URI (Atlas recommended)
- Cloudinary credentials
- Google OAuth Client ID
- Razorpay and RazorpayX test/live credentials

## 2. Backend Deployment (Server)

Project path: `server/`

### Build/start
- Install: `npm ci`
- Start: `npm start`
- Health check: `GET /health`

### Required environment variables
Use `server/.env.example` as template.

Minimum required:
- `PORT`
- `MONGODB_URI`
- `CORS_ORIGIN`
- `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

For winner payouts (RazorpayX):
- `RAZORPAYX_KEY_ID`
- `RAZORPAYX_KEY_SECRET`
- `RAZORPAYX_SOURCE_ACCOUNT_NUMBER`

### Recommended platform settings
- Runtime: Node 20+
- Auto deploy from main branch
- Health endpoint: `/health`
- Restart policy: always

### Render-specific settings
- Service type: `Web Service`
- Root directory: `server`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/health`
- Environment: set secrets in Render dashboard, not in `.env`
- MongoDB Atlas: allow Render to reach Atlas. If Atlas blocks the connection, add an allowed network entry for Render traffic (commonly `0.0.0.0/0` for hosted platforms unless you use a stricter network setup).

## 3. Frontend Deployment (Client)

Project path: `client/`

### Build/start
- Install: `npm ci`
- Build: `npm run build`
- Preview: `npm run preview`

### Required environment variables
Use `client/.env.example` as template.

- `VITE_API_BASE_URL=https://your-backend-domain/api/v1`
- `VITE_GOOGLE_CLIENT_ID=<same google client id>`

### Notes
- Frontend must point to deployed backend URL.
- Backend `CORS_ORIGIN` must include deployed frontend domain.

## 4. Post-Deployment Checklist
- Open backend health URL and confirm HTTP 200.
- Create subscription order from frontend and confirm Razorpay popup opens.
- Complete signup/signin with email and Google.
- Test winner update flow from admin.
- Verify payout creation in RazorpayX dashboard.

## 5. Security Checklist
- Rotate keys that were used in local/shared files.
- Do not commit real `.env` files.
- Use platform secret manager for env variables.
- Use production credentials only after test flow passes.

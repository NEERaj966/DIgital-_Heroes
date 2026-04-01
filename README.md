# Digital Heroes

Digital Heroes is a full-stack golf subscription and prize management platform built with a React frontend and an Express + MongoDB backend. It supports paid user signup through Stripe Checkout, admin-managed monthly draws, charity contribution preferences, winner proof review, and winner payouts through Stripe Connect transfers.

## What The Project Does

Digital Heroes combines subscription access with a monthly prize workflow:

- Players sign up with email/password or Google.
- Subscription payments are handled through Stripe Checkout.
- Only users with an active subscription can access protected player features.
- Players can track scores, choose a charity preference, and view draw results.
- Admins manage users, charities, monthly draws, winners, and reports.
- Winner payouts are routed through Stripe Connect after onboarding is completed.

## Main Features

- Subscription-based user onboarding with Stripe Checkout
- Email/password and Google sign in for users
- Admin registration and authentication
- Protected user area for subscribed members
- Monthly draw simulation and publishing
- Score tracking for players
- Charity preference selection and donation tracking
- Winner proof upload and review
- Stripe Connect onboarding for winners
- Prize transfer flow from platform balance to winner connected accounts
- Admin reporting for users, payouts, subscriptions, donations, and scores

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Tailwind CSS
- Framer Motion
- Axios

### Backend

- Node.js 20+
- Express 5
- MongoDB + Mongoose
- Stripe
- Cloudinary
- JWT authentication
- Multer for file uploads

## Project Structure

```text
Digital _Heroes/
├── client/
│   ├── src/
│   │   ├── componant/
│   │   ├── constants/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vercel.json
├── server/
│   ├── src/
│   │   ├── constants/
│   │   ├── controllers/
│   │   ├── DB/
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── index.js
├── DEPLOYMENT.md
└── README.md
```

## Frontend Modules

### `client/src/pages`

These files define the screens used by players and admins.

- `Home.jsx`: landing page
- `Subscription.jsx`: plan comparison and subscription messaging
- `UserSignup.jsx`: subscription signup and Stripe Checkout redirect
- `UserSignIn.jsx`: user login
- `UserSubscriberHub.jsx`: main subscribed user hub
- `UserScoresPage.jsx`: score tracking and score history
- `UserCharityPage.jsx`: charity selection and contribution settings
- `UserWinningsPage.jsx`: winner payout and Stripe onboarding actions
- `UserWinnerProofPage.jsx`: proof upload flow for winners
- `UserSettingsPage.jsx`: user profile and account settings
- `AdminSignIn.jsx` / `AdminSignup.jsx`: admin auth
- `AdminUsersPage.jsx`: user management
- `AdminDrawsPage.jsx`: monthly draw setup, simulation, and publishing
- `AdminCharitiesPage.jsx`: charity management
- `AdminWinnersPage.jsx`: winner review and payout actions
- `AdminReportsPage.jsx`: reporting dashboard
- `AdminSettingsPage.jsx` / `AdminProfile.jsx`: admin account management

### `client/src/context`

- `UserContext.jsx`: current user session state
- `AdminContext.jsx`: current admin session state
- `ThemeContext.jsx`: theme switching state

### `client/src/componant`

Reusable UI building blocks such as navbar, footer, menus, and Google auth button. The folder name is currently spelled `componant` in the project and is used that way in imports.

### `client/src/utils`

Shared frontend utilities such as API configuration and Google auth helpers.

## Backend Modules

### `server/src/routes`

Route files define the API surface:

- `User.routes.js`: user auth, subscription checkout, profile, scores, charities, winner proof, payouts, draw results
- `Admin.routes.js`: admin auth, users, charities, draws, winners, reports

### `server/src/controllers`

Controller files contain the main request handling logic:

- `User.controller.js`: player-facing actions and subscription activation
- `Admin.controller.js`: admin workflows, draw publishing, winner review, and reporting

### `server/src/modules`

Mongoose models representing the main business entities:

- `user.module.js`: player/admin identity, subscription state, payout state
- `Admin.module.js`: admin-specific profile and permissions
- `Payment.module.js`: Stripe subscription payment records
- `Score.module.js`: player scores
- `Draw.module.js`: monthly draw setup, simulations, published results, payout summaries
- `Donation.module.js`: charity donation records from winner contributions
- `Charities.module.js`: charities available in the system
- `blacklist.module.js`: invalidated auth tokens
- `Leaderboards.module.js`, `Sponsers.module.js`: additional project entities

### `server/src/utils`

Important backend service utilities:

- `stripe.js`: Stripe Checkout session creation and confirmation helpers
- `winnerPayout.js`: Stripe Connect onboarding and transfer-based payout logic
- `drawEngine.js`: draw simulation and result calculation
- `subscriptionAccess.js`: repairs or syncs subscription state from completed payments
- `winnerState.js`: normalizes winner proof and payout status values
- `googleAuth.js`: Google token verification
- `Cloudinary.js`: media upload helper
- `Apiresponse.js`, `Apierror.js`, `AsyncHanddler.js`: API response and error infrastructure

### `server/src/middleware`

- JWT verification for users and admins
- Subscription access guards
- Multer upload middleware

### `server/src/DB`

- MongoDB connection bootstrap

## Key Functional Flows

### 1. Subscription Signup Flow

1. The user chooses a plan in `UserSignup.jsx`.
2. The frontend calls `/api/v1/users/subscription/checkout-session`.
3. The backend creates or updates the user record in inactive subscription state.
4. Stripe Checkout redirects the user to payment.
5. Stripe returns the user to `/signup?checkout=success&session_id=...`.
6. The frontend confirms the session through `/api/v1/users/subscription/confirm`.
7. The backend marks the payment as completed and activates the subscription.

### 2. Monthly Draw Flow

1. Admin configures the current draw.
2. Admin simulates the draw using the draw engine.
3. Admin publishes the draw.
4. Published winner amounts are written back to user winnings.
5. Optional charity deductions are recorded in donations and charity totals.

### 3. Winner Payout Flow

This project now uses Stripe Connect transfers instead of Stripe Global Payouts.

1. A winner has outstanding winnings.
2. Winner proof is uploaded by the player and reviewed by admin.
3. The winner completes Stripe Connect onboarding through a generated account link.
4. Once approved and ready, the backend transfers prize funds from the platform Stripe balance to the winner connected account.
5. Payout state is stored in `latestPayout` on the user record.

## Current Stripe Usage

The project currently uses Stripe for two separate responsibilities:

- Subscription billing through Stripe Checkout
- Winner payouts through Stripe Connect transfers

### Stripe Connect Payout Logic

The payout utility in `server/src/utils/winnerPayout.js` now:

- creates or reuses a connected account for the winner
- creates onboarding or update links through Stripe Connect
- transfers prize money with `stripe.transfers.create()`
- syncs saved payout state from transfer records

This design assumes:

- the platform already collects money from users
- the platform has available Stripe balance in test mode or live mode
- the winner has completed onboarding and can receive transfers

## API Overview

### User API

Base path: `/api/v1/users`

Main capabilities:

- subscription checkout and confirmation
- user login and Google login
- profile fetch and update
- password change
- charity list and charity preference update
- winner proof upload
- winner payout setup link creation
- draw results
- score create, read, and update

### Admin API

Base path: `/api/v1/admins`

Main capabilities:

- admin register/login
- admin profile and permissions
- user management
- score review/edit
- charity management
- draw config, simulation, and publish
- winner management and payout triggering
- reports

## Local Development

## Prerequisites

- Node.js 20 or later
- MongoDB database
- Stripe test account
- Cloudinary account
- Google OAuth client ID

## Install

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Environment Variables

### Backend

Use `server/.env.example` as the base reference.

Important variables:

- `PORT`
- `MONGODB_URI`
- `CORS_ORIGIN`
- `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_REGULAR_MONTHLY`
- `STRIPE_PRICE_POPULAR_MONTHLY`
- `STRIPE_PRICE_YEARLY`
- `CLIENT_APP_URL`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PAYOUTS_ENABLED`
- `STRIPE_PAYOUT_RECIPIENT_COUNTRY`
- `STRIPE_PAYOUT_CURRENCY`

### Frontend

Use `client/.env.example` as the base reference.

Important variables:

- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`

## Running In Test Mode

For Stripe test mode:

- use `sk_test_...` secret keys
- use test product price IDs
- use Stripe test onboarding and transfer flows
- make sure the connected account flow is tested before switching to live mode

## Deployment Notes

- Backend and frontend are deployed separately.
- Frontend routing uses `BrowserRouter`, so Vercel must rewrite routes to `index.html`.
- This repo includes `client/vercel.json` for SPA rewrites when the deployed root is `client/`.
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment-specific guidance.

## Security Notes

- Do not commit real `.env` files or live credentials.
- Rotate any exposed credentials immediately.
- Keep Stripe keys, MongoDB URIs, Cloudinary secrets, and JWT secrets in environment variables only.
- Use test mode until the full subscription and payout flow is verified end to end.

## Suggested Next Documentation Updates

- Add screenshots for user and admin flows
- Add a database schema diagram
- Add a concise API reference table for each endpoint
- Add test instructions once automated tests are introduced

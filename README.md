# Rural HealthCare System

A full-stack, offline-capable digital healthcare platform tailored for rural and semi-urban communities. It bridges the gap between rural patients, local primary health centres, and remote specialized medical practitioners.

## Features
- **Multi-Role Authentication**: Secure JWT-based authentication for Patients, Doctors, and Administrators.
- **Telemedicine & Consultations**: Real-time video/audio calling rooms, live chat, vitals recording, and digital prescription issuance.
- **Appointment Scheduling**: Online slot booking with conflict detection for hospital visits and digital consultations.
- **Health Centre & Emergency Services**: Geo-mapping of primary health centres, ambulance dispatch contacts, and offline emergency caches.
- **Multilingual Localization**: Broad Indian language support (English, Hindi, Bengali, Tamil, Telugu, Marathi, Kannada, Gujarati, Malayalam, Punjabi, Odia).
- **Dual Persistence Architecture**: MongoDB Atlas cloud synchronization with automatic fallback to persistent JSON storage for intermittent network environments.

## Tech Stack
- **Frontend**: React 18, Vite, CSS Modules, Lucide React
- **Backend**: Node.js, Express.js, Mongoose, JWT, bcryptjs
- **Database**: MongoDB / MongoDB Atlas + Local JSON fallback

## Getting Started

### 1. Installation
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure your settings:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.dyvzmqn.mongodb.net/rural_healthcare
```

### 3. Run Development Server
```bash
npm run dev
```
Access the application at `http://localhost:5173` (or the configured Vite port).

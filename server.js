const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config({ override: true });

// Ensure reliable DNS resolution for MongoDB Atlas SRV connection strings on Windows networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (dnsErr) {
  // Use default system DNS if custom nameservers are not permitted
}

// Ensure fallback JWT secret if not configured in environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-healthcare-jwt-key-2026';

const app = express();

// Core Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

// Import Backend Routes
const authRoutes = require('./backend/routes/authRoutes');
const doctorRoutes = require('./backend/routes/doctorRoutes');
const appointmentRoutes = require('./backend/routes/appointmentRoutes');
const consultationRoutes = require('./backend/routes/consultationRoutes');
const recordRoutes = require('./backend/routes/recordRoutes');
const reminderRoutes = require('./backend/routes/reminderRoutes');
const centreRoutes = require('./backend/routes/centreRoutes');
const locationRoutes = require('./backend/routes/locationRoutes');
const { getStore, reloadStore, DB_FILE } = require('./backend/models/mockDb');
const fs = require('fs');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/hospitals', centreRoutes);
app.use('/api/locations', locationRoutes);

// Health check and database status API
app.get('/api/health', (req, res) => {
  const isMongoConnected = mongoose.connection && mongoose.connection.readyState === 1;
  res.json({
    status: 'ok',
    database: isMongoConnected ? 'mongodb-connected' : 'persistent-file-store',
    dbName: isMongoConnected ? mongoose.connection.name : 'database.json',
    host: isMongoConnected ? mongoose.connection.host : 'local',
    message: isMongoConnected 
      ? `Connected directly to MongoDB (${mongoose.connection.name}) — Compass Ready!` 
      : 'Using persistent disk-backed database (database.json). Enter MongoDB URI to save to MongoDB Compass.',
    timestamp: new Date().toISOString()
  });
});

// Helper: Migrate existing JSON data to MongoDB
async function migrateJsonToMongo() {
  try {
    const store = getStore();
    const User = require('./backend/models/User');
    const Doctor = require('./backend/models/Doctor');
    const HealthCentre = require('./backend/models/HealthCentre');
    const Appointment = require('./backend/models/Appointment');
    const HealthRecord = require('./backend/models/HealthRecord');
    const MedicineReminder = require('./backend/models/MedicineReminder');

    if (store.users && store.users.length > 0) {
      for (const u of store.users) {
        const exists = await User.findOne({ phone: u.phone });
        if (!exists) {
          await User.create(u);
        }
      }
    }
    if (store.doctors && store.doctors.length > 0) {
      for (const d of store.doctors) {
        const exists = await Doctor.findOne({ name: d.name });
        if (!exists) {
          await Doctor.create(d);
        }
      }
    }
    if (store.centres && store.centres.length > 0) {
      for (const c of store.centres) {
        const exists = await HealthCentre.findOne({ name: c.name });
        if (!exists) {
          await HealthCentre.create(c);
        }
      }
    }
    if (store.appointments && store.appointments.length > 0) {
      for (const a of store.appointments) {
        const exists = await Appointment.findOne({ date_time: a.date_time, user_id: a.user_id });
        if (!exists) {
          await Appointment.create(a);
        }
      }
    }
    if (store.records && store.records.length > 0) {
      for (const r of store.records) {
        const exists = await HealthRecord.findOne({ diagnosis: r.diagnosis, user_id: r.user_id });
        if (!exists) {
          await HealthRecord.create(r);
        }
      }
    }
    if (store.reminders && store.reminders.length > 0) {
      for (const m of store.reminders) {
        const exists = await MedicineReminder.findOne({ medicine: m.medicine, user_id: m.user_id });
        if (!exists) {
          await MedicineReminder.create(m);
        }
      }
    }
    console.log('[Migration] Database records migrated to MongoDB successfully!');
  } catch (err) {
    console.warn('[Migration] Error during JSON to Mongo migration:', err.message);
  }
}

// Connect dynamically to external MongoDB (Atlas / Compass)
app.post('/api/database/connect-mongo', async (req, res) => {
  const { mongoUri } = req.body;
  if (!mongoUri || (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))) {
    return res.status(400).json({ error: 'Please enter a valid MongoDB URI starting with mongodb:// or mongodb+srv://' });
  }

  try {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });

    // Save to .env
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.includes('MONGO_URI=')) {
      envContent = envContent.replace(/MONGO_URI=.*(\r?\n|$)/, `MONGO_URI=${mongoUri}$1`);
    } else {
      envContent += `\nMONGO_URI=${mongoUri}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');

    // Migrate any data from database.json to MongoDB
    await migrateJsonToMongo();

    res.json({
      success: true,
      message: `Connected successfully to MongoDB! You can now open MongoDB Compass and connect to the same URI.`,
      host: mongoose.connection.host,
      database: mongoose.connection.name
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    res.status(500).json({ error: `Connection failed: ${err.message}` });
  }
});

// Live Database State & Sync API
app.get('/api/database', async (req, res) => {
  try {
    const isMongoConnected = mongoose.connection && mongoose.connection.readyState === 1;
    let counts = { users: 0, doctors: 0, appointments: 0, centres: 0, records: 0, reminders: 0 };
    let data = null;

    if (isMongoConnected) {
      const User = require('./backend/models/User');
      const Doctor = require('./backend/models/Doctor');
      const Appointment = require('./backend/models/Appointment');
      const HealthCentre = require('./backend/models/HealthCentre');
      const HealthRecord = require('./backend/models/HealthRecord');
      const MedicineReminder = require('./backend/models/MedicineReminder');

      const [users, doctors, appointments, centres, records, reminders] = await Promise.all([
        User.find(),
        Doctor.find(),
        Appointment.find(),
        HealthCentre.find(),
        HealthRecord.find(),
        MedicineReminder.find()
      ]);

      counts = {
        users: users.length,
        doctors: doctors.length,
        appointments: appointments.length,
        centres: centres.length,
        records: records.length,
        reminders: reminders.length
      };

      data = { users, doctors, appointments, centres, records, reminders };

      res.json({
        success: true,
        source: 'mongodb',
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
        lastModified: new Date(),
        counts,
        data
      });
    } else {
      const store = getStore();
      const stat = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : null;
      res.json({
        success: true,
        source: 'file',
        filePath: 'backend/data/database.json',
        lastModified: stat ? stat.mtime : new Date(),
        counts: {
          users: store.users?.length || 0,
          doctors: store.doctors?.length || 0,
          appointments: store.appointments?.length || 0,
          centres: store.centres?.length || 0,
          records: store.records?.length || 0,
          reminders: store.reminders?.length || 0
        },
        data: store
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/database/reload', (req, res) => {
  try {
    const store = reloadStore();
    res.json({
      success: true,
      message: 'Database reloaded successfully',
      counts: {
        users: store.users?.length || 0,
        doctors: store.doctors?.length || 0,
        appointments: store.appointments?.length || 0,
        centres: store.centres?.length || 0,
        records: store.records?.length || 0,
        reminders: store.reminders?.length || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Explicit download / direct access endpoints for database.json
app.get(['/data/database.json', '/backend/data/database.json', '/api/database/download'], (req, res) => {
  const rootPath = path.join(__dirname, 'data/database.json');
  const backendPath = path.join(__dirname, 'backend/data/database.json');
  const targetPath = fs.existsSync(rootPath) ? rootPath : backendPath;

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Database file not found' });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(targetPath);
});

// Database Connection Handling
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

async function initMongoConnection(uri) {
  if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) || uri.includes('<username>')) {
    console.log('[Database] Using persistent file-based database (data/database.json)');
    return;
  }

  try {
    const isAtlas = uri.startsWith('mongodb+srv://');
    console.log(`[Database] Connecting to ${isAtlas ? 'MongoDB Atlas Cloud' : 'MongoDB'}...`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000
    });
    console.log(`[Database] MongoDB Connected Successfully!`);
    console.log(`[Database] Host: ${mongoose.connection.host}`);
    console.log(`[Database] Database: ${mongoose.connection.name}`);

    // Auto-migrate seed data to cloud database if not already present
    await migrateJsonToMongo();
  } catch (err) {
    console.warn(`[Database] MongoDB connection error (${err.message}) — falling back to persistent file store`);
  }
}

// Error middleware for handling Mongoose connection drops gracefully
app.use((err, req, res, next) => {
  if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && err.message.includes('buffering timed out'))) {
    console.warn('[AI Studio] Database offline — returning fallback response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

const net = require('net');
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const HOST = process.env.HOST || '0.0.0.0';

function findAvailablePort(startPort, host = '0.0.0.0', maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const testNext = () => {
      if (port > startPort + maxAttempts) {
        return reject(new Error(`Could not find an open port between ${startPort} and ${port}`));
      }
      const tester = net.createServer();
      tester.unref();
      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          console.warn(`[Port Conflict] Port ${port} is in use. Checking port ${port + 1}...`);
          port++;
          testNext();
        } else {
          reject(err);
        }
      });
      tester.once('listening', () => {
        tester.close(() => {
          resolve(port);
        });
      });
      tester.listen(port, host);
    };
    testNext();
  });
}

async function startServer() {
  // Connect to MongoDB Atlas or local MongoDB before starting HTTP listener
  await initMongoConnection(mongoUri);

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'frontend/dist');
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      app.get('/', (req, res) => {
        res.json({
          status: 'ok',
          service: 'Rural Health Care System Backend API',
          health: '/api/health'
        });
      });
    }
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: path.join(__dirname, 'frontend')
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite middleware could not be loaded, falling back to static files:', viteErr.message);
      const distPath = path.join(__dirname, 'frontend/dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const port = await findAvailablePort(DEFAULT_PORT, HOST);

  const server = app.listen(port, HOST, () => {
    console.log(`\n==================================================`);
    console.log(` Rural Health Care System Server is Live!`);
    console.log(` Local:   http://localhost:${port}`);
    console.log(` Network: http://127.0.0.1:${port}`);
    console.log(` Database: ${mongoose.connection.readyState === 1 ? 'MongoDB (' + mongoose.connection.name + ')' : 'File-based Store (backend/data/database.json)'}`);
    console.log(`==================================================\n`);
  });

  server.on('error', (err) => {
    console.error('Server error encountered:', err);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


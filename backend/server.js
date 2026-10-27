const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
require('dotenv').config();

// Ensure reliable DNS resolution for MongoDB Atlas SRV connection strings on Windows networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (dnsErr) {}

const { bookAppointment, getAppointments } = require('./controllers/appointmentController');
const { verifyToken } = require('./middleware/authMiddleware');
// Import Routes
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');


// Import Consultation Routes
const consultationRoutes = require('./routes/consultationRoutes');

// Import Health Record Routes
const recordRoutes = require('./routes/recordRoutes');

// Import Reminder Routes
const reminderRoutes = require('./routes/reminderRoutes');

// Import Health Centre Routes
const centreRoutes = require('./routes/centreRoutes');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Temporary inline route test for appointments

// API Routes

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);

// Register under API routes
app.use('/api/consultations', consultationRoutes);

// Register under API routes
app.use('/api/records', recordRoutes);

// Register under API routes
app.use('/api/reminders', reminderRoutes);

app.use('/api/centres', centreRoutes);


// Database Connection
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rural_healthcare';
mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 15000 })
  .then(() => console.log('MongoDB Connected Successfully to:', mongoose.connection.name))
  .catch((err) => console.log('Database connection error: ', err.message));



// Test Route
app.get('/', (req, res) => {
  res.send('Rural Health Care System API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
module.exports = app;
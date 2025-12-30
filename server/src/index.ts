import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import electionRoutes from './routes/electionRoutes';
import candidateRoutes from './routes/candidateRoutes';
import resultRoutes from './routes/resultRoutes';
import mapRoutes from './routes/mapRoutes';
import referenceRoutes from './routes/referenceRoutes';
import issueRoutes from './routes/issueRoutes';
import pollingStationRoutes from './routes/pollingStationRoutes';
import demographicsRoutes from './routes/demographicsRoutes';
import { websocketService } from './services/websocketService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Uganda Electoral Map Server',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/polling-stations', pollingStationRoutes);
app.use('/api/demographics', demographicsRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`👥 User management: http://localhost:${PORT}/api/users`);

  // Initialize WebSocket server
  const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3001;
  websocketService.initialize(WS_PORT);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import customerRoutes from './routes/customer.routes.js';
import managerRoutes from './routes/manager.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.clientOrigin.split(',').map((origin) => origin.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/health', healthRoutes);
app.use(`${env.apiPrefix}/auth`, authRoutes);
app.use(`${env.apiPrefix}/admin`, adminRoutes);
app.use(`${env.apiPrefix}/customer`, customerRoutes);
app.use(`${env.apiPrefix}/manager`, managerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

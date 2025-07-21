import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { json } from 'body-parser';
import routes from './routes/index';

dotenv.config();

const app = express();
app.use(cors());
app.use(json());
app.use('/api', routes);

export default app;

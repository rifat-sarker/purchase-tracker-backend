import winston from 'winston';
import config from '../config';

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    config.env === 'production' ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;

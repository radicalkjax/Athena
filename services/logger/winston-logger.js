const winston = require('winston');
const { createLogstashTransport } = require('./logstash-transport');

// Log format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Log format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { 
    service: 'athena-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Add Logstash transport if configured
if (process.env.LOGSTASH_HOST) {
  logger.add(createLogstashTransport({
    host: process.env.LOGSTASH_HOST,
    port: parseInt(process.env.LOGSTASH_PORT || '5000'),
    reconnectInterval: 5000,
    maxConnectRetries: 5
  }));
  
  logger.info('Logstash transport enabled', { 
    host: process.env.LOGSTASH_HOST,
    port: process.env.LOGSTASH_PORT || 5000
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason,
    promise: promise 
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});

// Wrapper to maintain backward compatibility with existing logger
const compatibleLogger = {
  error: (message, meta) => logger.error(message, { metadata: meta }),
  warn: (message, meta) => logger.warn(message, { metadata: meta }),
  info: (message, meta) => logger.info(message, { metadata: meta }),
  debug: (message, meta) => logger.debug(message, { metadata: meta }),
  
  // Additional methods for structured logging
  logRequest: (req, res, responseTime) => {
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: responseTime,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id
    });
  },
  
  logSecurityEvent: (eventType, details) => {
    logger.warn('Security Event', {
      eventType: eventType,
      ...details,
      timestamp: new Date().toISOString()
    });
  },
  
  logPerformance: (operation, duration, details = {}) => {
    logger.info('Performance Metric', {
      operation: operation,
      duration: duration,
      ...details
    });
  }
};

module.exports = {
  logger: compatibleLogger,
  winstonLogger: logger
};
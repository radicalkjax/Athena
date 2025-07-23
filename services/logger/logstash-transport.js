const winston = require('winston');
const net = require('net');

/**
 * Winston transport for Logstash
 * Sends logs to Logstash TCP input
 */
class LogstashTransport extends winston.Transport {
  constructor(options = {}) {
    super(options);
    
    this.name = 'logstash';
    this.host = options.host || 'localhost';
    this.port = options.port || 5000;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxConnectRetries = options.maxConnectRetries || 5;
    this.connected = false;
    this.retries = 0;
    
    this.connect();
  }

  connect() {
    if (this.socket) {
      this.socket.destroy();
    }

    this.socket = new net.Socket();
    
    this.socket.on('connect', () => {
      this.connected = true;
      this.retries = 0;
      this.emit('connected');
    });

    this.socket.on('error', (err) => {
      this.connected = false;
      this.emit('error', err);
      this.reconnect();
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.reconnect();
    });

    try {
      this.socket.connect(this.port, this.host);
    } catch (err) {
      this.emit('error', err);
      this.reconnect();
    }
  }

  reconnect() {
    if (this.retries >= this.maxConnectRetries) {
      this.emit('error', new Error('Max connection retries reached'));
      return;
    }

    this.retries++;
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (!this.connected) {
      callback();
      return;
    }

    // Format log entry for Logstash
    const logEntry = {
      '@timestamp': new Date().toISOString(),
      level: info.level,
      message: info.message,
      service: 'athena-api',
      environment: process.env.NODE_ENV || 'development',
      ...info.metadata
    };

    // Add error details if present
    if (info.error) {
      logEntry.error = {
        message: info.error.message,
        stack: info.error.stack,
        type: info.error.constructor.name
      };
    }

    // Send to Logstash
    try {
      this.socket.write(JSON.stringify(logEntry) + '\n', 'utf8', callback);
    } catch (err) {
      this.emit('error', err);
      callback();
    }
  }

  close() {
    if (this.socket) {
      this.socket.destroy();
    }
  }
}

// Factory function to create transport
function createLogstashTransport(options) {
  return new LogstashTransport(options);
}

module.exports = {
  LogstashTransport,
  createLogstashTransport
};
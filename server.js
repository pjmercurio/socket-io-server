const express = require('express');
const fs = require('fs');
const https = require('https');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const cors = require('cors');

// Load SSL certificates
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/pauljmercurio.tplinkdns.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/pauljmercurio.tplinkdns.com/fullchain.pem'),
};

const socketPort = 4000;
const app = express();
const server = https.createServer(sslOptions, app);

// Enable CORS for all origins
app.use(cors());

const io = socketIo(server, {
    cors: {
        origin: "*",  // Allow any origin
        methods: ["GET", "POST"],
    }
});

const mySqlConnection = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '*****',
  database: 'chats',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create an endpoint to get messages from the last hour
app.get('/messages/last-hour', (req, res) => {
  const query = `
    SELECT username, message, timestamp
    FROM messages
    WHERE timestamp >= NOW() - INTERVAL 1 HOUR
    ORDER BY timestamp ASC
  `;

  mySqlConnection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err.stack);
      return res.status(500).json({ error: 'Database query error' });
    }

    res.json(results);
  });
});

// Create an endpoint to get messages from the x last hours based on the query parameter
app.get('/messages/recent', (req, res) => {
  const hours = req.query.hours || 1;

  const query = `
    SELECT username, message, timestamp
    FROM messages
    WHERE timestamp >= NOW() - INTERVAL ? HOUR
    ORDER BY timestamp ASC
  `;

  mySqlConnection.query(query, [hours], (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err.stack);
      return res.status(500).json({ error: 'Database query error' });
    }

    res.json(results);
  });
});

// Create an endpoint to get the last message that began with 'CURRENT ALBUM:'
app.get('/messages/current-album', (req, res) => {
  const query = `
    SELECT username, message, timestamp
    FROM messages
    WHERE message LIKE 'CURRENT ALBUM:%'
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  mySqlConnection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err.stack);
      return res.status(500).json({ error: 'Database query error' });
    }

    res.json(results);
  });
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);

    // Insert the message into MySQL
    const { username, message } = msg;
    const query = `INSERT INTO messages (username, message) VALUES (?, ?)`;
    mySqlConnection.query(query, [username, message], (err, results) => {
        if (err) {
            console.error('Error inserting message into MySQL:', err.stack);
        } else {
            console.log('Message inserted with ID:', results.insertId);
        }
    });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(socketPort, '0.0.0.0', () => {
  console.log(`Socket.IO server running on port ${socketPort}`);
});

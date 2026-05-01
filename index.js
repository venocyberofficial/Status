const express = require('express');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Store active connections
const activeConnections = new Map();
const pairingCodes = new Map();

// Logger configuration
const logger = pino({ 
    level: 'silent',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

// Serve the main interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to request pairing code
app.post('/api/request-pairing-code', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        // Validate phone number
        if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber.replace(/[\s\-\+]/g, ''))) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid phone number. Please enter a valid number.' 
            });
        }

        const cleanNumber = phoneNumber.replace(/[\s\-\+]/g, '');
        
        // Check if already connected
        if (activeConnections.has(cleanNumber)) {
            return res.status(409).json({ 
                success: false, 
                message: 'A connection already exists for this number. Please restart the session.' 
            });
        }

        // Generate pairing code
        const pairingCode = await generatePairingCode(cleanNumber);
        
        if (!pairingCode) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to generate pairing code. Please try again.' 
            });
        }

        res.json({ 
            success: true, 
            pairingCode: pairingCode,
            message: 'Use this code in your WhatsApp Linked Devices section'
        });

    } catch (error) {
        logger.error('Error generating pairing code:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error. Please try again later.' 
        });
    }
});

// API endpoint to check connection status
app.get('/api/connection-status/:phoneNumber', (req, res) => {
    const { phoneNumber } = req.params;
    const cleanNumber = phoneNumber.replace(/[\s\-\+]/g, '');
    
    const isConnected = activeConnections.has(cleanNumber) && 
                       activeConnections.get(cleanNumber).connected;
    
    res.json({ 
        connected: isConnected,
        phoneNumber: cleanNumber
    });
});

// Generate pairing code function
async function generatePairingCode(phoneNumber) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`auth_info_${phoneNumber}`);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            defaultQueryTimeoutMs: undefined
        });

        // Store auth state save function
        activeConnections.set(phoneNumber, { 
            sock, 
            saveCreds, 
            connected: false,
            isViewing: false
        });

        // Request pairing code
        const code = await sock.requestPairingCode(phoneNumber);
        
        // Remove special characters from the code
        const cleanCode = code?.match(/.{1,4}/g)?.join("-") || code;
        
        // Set up event handlers
        setupEventHandlers(sock, phoneNumber, saveCreds);
        
        return cleanCode;

    } catch (error) {
        logger.error('Pairing code generation error:', error);
        activeConnections.delete(phoneNumber);
        return null;
    }
}

// Set up all event handlers
function setupEventHandlers(sock, phoneNumber, saveCreds) {
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            logger.info(`✅ Connected successfully for ${phoneNumber}`);
            
            if (activeConnections.has(phoneNumber)) {
                activeConnections.get(phoneNumber).connected = true;
            }
            
            // Send welcome message
            setTimeout(async () => {
                try {
                    const jid = phoneNumber.includes('@s.whatsapp.net') ? 
                               phoneNumber : `${phoneNumber}@s.whatsapp.net`;
                    
                    await sock.sendMessage(jid, { 
                        text: `Dear User,\n\nVenocyber Status View King 👑 is connected successfully.\n\n*Congratulations!* 🎉\n\nYour status viewing service is now active. The bot will automatically view all status updates from your contacts.\n\nRegards,\n*Venocyber Status View King* 👑` 
                    });
                    
                    // Start status viewing
                    startStatusViewing(sock, phoneNumber);
                    
                } catch (error) {
                    logger.error('Error sending welcome message:', error);
                }
            }, 3000);
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            
            logger.warn(`⚠️ Connection closed for ${phoneNumber}. Reconnecting: ${shouldReconnect}`);
            
            if (activeConnections.has(phoneNumber)) {
                activeConnections.get(phoneNumber).connected = false;
            }
            
            if (shouldReconnect) {
                await reconnectBot(phoneNumber, saveCreds);
            } else {
                activeConnections.delete(phoneNumber);
                cleanupAuth(phoneNumber);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Start viewing statuses
async function startStatusViewing(sock, phoneNumber) {
    if (!activeConnections.has(phoneNumber) || activeConnections.get(phoneNumber).isViewing) {
        return;
    }

    activeConnections.get(phoneNumber).isViewing = true;
    logger.info(`👁️ Started viewing statuses for ${phoneNumber}`);

    const viewStatuses = async () => {
        try {
            if (!activeConnections.has(phoneNumber) || !activeConnections.get(phoneNumber).connected) {
                return;
            }

            const statusJidList = await getStatusContacts(sock);
            
            if (statusJidList && statusJidList.length > 0) {
                for (const jid of statusJidList) {
                    try {
                        await sock.readMessages([{
                            remoteJid: jid,
                            id: 'status@broadcast'
                        }]);
                        logger.info(`👁️ Viewed status from: ${jid}`);
                    } catch (error) {
                        logger.error(`Error viewing status from ${jid}:`, error.message);
                    }
                }
            }
        } catch (error) {
            logger.error('Error in status viewing cycle:', error.message);
        }
    };

    // Initial view
    await viewStatuses();

    // Set interval for continuous viewing (every 10 seconds)
    if (activeConnections.has(phoneNumber)) {
        activeConnections.get(phoneNumber).viewInterval = setInterval(viewStatuses, 10000);
    }
}

// Get all contacts with status updates
async function getStatusContacts(sock) {
    try {
        const result = await sock.fetchStatus();
        const statusContacts = [];
        
        if (result && typeof result === 'object') {
            for (const [jid, status] of Object.entries(result)) {
                if (status && status.setAt) {
                    statusContacts.push(jid);
                }
            }
        }
        
        return statusContacts;
    } catch (error) {
        logger.error('Error fetching status contacts:', error.message);
        return [];
    }
}

// Reconnect bot with retry logic
async function reconnectBot(phoneNumber, saveCreds) {
    let retries = 0;
    const maxRetries = 5;
    
    const attemptReconnect = async () => {
        if (retries >= maxRetries) {
            logger.error(`❌ Max retries reached for ${phoneNumber}. Giving up.`);
            activeConnections.delete(phoneNumber);
            return;
        }

        retries++;
        logger.info(`🔄 Reconnection attempt ${retries}/${maxRetries} for ${phoneNumber}`);

        try {
            const { state } = await useMultiFileAuthState(`auth_info_${phoneNumber}`);
            
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: ['Ubuntu', 'Chrome', '20.0.04'],
                defaultQueryTimeoutMs: 60000
            });

            activeConnections.set(phoneNumber, { 
                sock, 
                saveCreds, 
                connected: false,
                isViewing: false 
            });

            setupEventHandlers(sock, phoneNumber, saveCreds);

        } catch (error) {
            logger.error(`Reconnection failed:`, error.message);
            setTimeout(attemptReconnect, 5000 * retries);
        }
    };

    setTimeout(attemptReconnect, 2000);
}

// Clean up auth files
function cleanupAuth(phoneNumber) {
    const authPath = `auth_info_${phoneNumber}`;
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        activeConnections: activeConnections.size
    });
});

// Keep-alive mechanism
if (process.env.KEEP_ALIVE_URL) {
    setInterval(() => {
        const https = require('https');
        https.get(process.env.KEEP_ALIVE_URL, (res) => {
            logger.info('Keep-alive ping sent');
        });
    }, 14 * 60 * 1000); // Every 14 minutes
}

// Start server
app.listen(PORT, () => {
    logger.info(`🌟 Venocyber Status View King 👑 running on port ${PORT}`);
    logger.info(`🌐 Web interface available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    for (const [phoneNumber, conn] of activeConnections) {
        if (conn.viewInterval) {
            clearInterval(conn.viewInterval);
        }
        if (conn.sock) {
            await conn.sock.logout();
        }
    }
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
});

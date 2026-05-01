const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// --- FRONTEND (WEB INTERFACE) ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Venocyber Status King</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #075e54; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; color: white; }
                .container { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; width: 350px; color: #333; }
                h2 { color: #075e54; margin-bottom: 10px; }
                input { width: 100%; padding: 12px; margin: 15px 0; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 16px; text-align: center; }
                button { width: 100%; padding: 12px; background: #25d366; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
                button:hover { background: #128c7e; }
                #pairing-code { margin-top: 20px; padding: 15px; background: #e7f3ef; border-radius: 8px; font-size: 24px; font-weight: bold; color: #075e54; display: none; letter-spacing: 4px; }
                .loader { display: none; margin-top: 10px; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Venocyber Status King 👑</h2>
                <p>Weka namba yako upate kodi ya kuunganisha bot.</p>
                <input type="number" id="number" placeholder="255625774543">
                <button onclick="getCode()">Tengeneza Pairing Code</button>
                <div id="loader" class="loader">Inatengeneza kodi, subiri...</div>
                <div id="pairing-code"></div>
                <p style="font-size: 11px; margin-top: 15px; color: #999;">Baada ya kupata kodi, nenda WhatsApp > Linked Devices > Link with Phone Number.</p>
            </div>

            <script>
                async function getCode() {
                    const num = document.getElementById('number').value;
                    const codeDiv = document.getElementById('pairing-code');
                    const loader = document.getElementById('loader');
                    if(!num) return alert("Weka namba ya simu!");
                    
                    loader.style.display = "block";
                    codeDiv.style.display = "none";
                    
                    try {
                        const res = await fetch('/pair?number=' + num);
                        const data = await res.json();
                        loader.style.display = "none";
                        if(data.code) {
                            codeDiv.innerText = data.code;
                            codeDiv.style.display = "block";
                        } else {
                            alert("Kuna tatizo, jaribu tena.");
                        }
                    } catch (e) {
                        loader.style.display = "none";
                        alert("Server error!");
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// --- BOT LOGIC ---
let sock;
async function connectToWhatsApp(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session_status_king');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "121.0.6167.85"]
    });

    sock.ev.on('creds.update', saveCreds);

    // Kazi ya Bot: Auto Status pekee
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const jid = msg.key.remoteJid;

        if (jid === 'status@broadcast') {
            await sock.readMessages([msg.key]); // View
            await sock.sendMessage(jid, { react: { text: "💚", key: msg.key } }, { statusJidList: [msg.key.participant, sock.user.id] }); // Like
        }
    });

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log("✅ Bot connected successful!");
            // Tuma ujumbe kwa mtumiaji (Bot owner)
            const myJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
            const myName = sock.user.name || "Mtumiaji";
            await sock.sendMessage(myJid, { text: `Dear ${myName} Venocyber status View king 👑 connected successful Enjoy` });
        }
    });

    // Request pairing code kama namba imewekwa toka Web
    if (num && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(num);
                if (res) res.json({ code: code });
            } catch (e) {
                if (res) res.json({ error: "Failed" });
            }
        }, 3000);
    }
}

// Route ya Web kuomba kodi
app.get('/pair', async (req, res) => {
    const num = req.query.number;
    if (!num) return res.json({ error: "No number" });
    connectToWhatsApp(num, res);
});

// Anza seva
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    connectToWhatsApp(); // Washa bot iwe tayari
});

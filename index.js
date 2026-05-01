const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

// Domain yako mpya kwa ajili ya Self-Ping (Anti-Sleep)
const MY_DOMAIN = "https://status.venocyber.co.tz";

app.use(express.json());

// --- FRONTEND (Ukurasa wa kuingiza namba) ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Venocyber Status Bot Panel</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .container { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; width: 350px; }
                h2 { color: #075e54; margin-bottom: 5px; }
                p { color: #666; font-size: 14px; margin-bottom: 25px; }
                input { width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 16px; outline: none; }
                input:focus { border-color: #25d366; }
                button { width: 100%; padding: 12px; background: #25d366; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
                button:hover { background: #128c7e; }
                #result { margin-top: 25px; padding: 15px; border-radius: 8px; background: #e7f3ef; color: #075e54; font-size: 22px; font-weight: bold; letter-spacing: 2px; display: none; }
                .footer { margin-top: 20px; font-size: 11px; color: #999; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Venocyber Pro</h2>
                <p>Auto-View Status & Auto-Like Status</p>
                <input type="text" id="phoneNumber" placeholder="Mfano: 255625774543">
                <button onclick="fetchCode()">Pata Pairing Code</button>
                <div id="result"></div>
                <div class="footer">Ingiza namba ya simu bila alama ya +</div>
            </div>

            <script>
                async function fetchCode() {
                    const num = document.getElementById('phoneNumber').value;
                    const resDiv = document.getElementById('result');
                    if(!num) return alert("Tafadhali weka namba kwanza!");
                    
                    resDiv.style.display = "block";
                    resDiv.innerText = "Inatafuta...";
                    
                    try {
                        const response = await fetch('/pair?code=' + num);
                        const data = await response.json();
                        resDiv.innerText = data.code || "Error! Jaribu tena.";
                    } catch (e) {
                        resDiv.innerText = "Server Error!";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// --- SELF-PING LOGIC (Anti-Sleep) ---
setInterval(() => {
    axios.get(MY_DOMAIN).then(() => {
        console.log("⚡ Self-Ping: Seva ipo macho kwenye " + MY_DOMAIN);
    }).catch(() => {});
}, 4 * 60 * 1000); // Inapiga kila dakika 4

// --- BOT CORE ENGINE ---
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('venocyber_status_v15');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ["Mac OS", "Chrome", "121.0.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    // Kazi kuu: Auto-Status
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const jid = msg.key.remoteJid;

        if (jid === 'status@broadcast') {
            try {
                await sock.readMessages([msg.key]); // View Status
                await sock.sendMessage(jid, { 
                    react: { text: "💚", key: msg.key } 
                }, { statusJidList: [msg.key.participant, sock.user.id] }); // Like Status
                console.log(`✅ Status Viewed & Liked: ${msg.key.participant}`);
            } catch (e) { console.log("Status Error"); }
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log("✅ BOT IKO TAYARI NA IPO ONLINE!");
        }
    });

    // API ya ku-pair toka kwenye ukurasa wa web
    app.get('/pair', async (req, res) => {
        let codeNum = req.query.code;
        if (!codeNum) return res.json({ error: "No number" });
        
        try {
            if (!sock.authState.creds.registered) {
                let code = await sock.requestPairingCode(codeNum);
                res.json({ code: code });
            } else {
                res.json({ code: "Tayari Imeunganishwa!" });
            }
        } catch (e) {
            res.json({ error: "Failed" });
        }
    });
}

startBot();
app.listen(PORT, () => console.log(`Seva imewaka kwenye Port ${PORT}`));

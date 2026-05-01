const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const fs = require("fs-extra");

const app = express();
const PORT = process.env.PORT || 10000;
const SESSION_PATH = './session_king';

app.use(express.json());

// MUONEKANO MKUBWA NA MZURI (RESPONSIVE)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Venocyber Status King</title>
            <style>
                body { font-family: -apple-system, system-ui, sans-serif; background: #128C7E; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .card { background: white; padding: 40px 25px; border-radius: 25px; width: 95%; max-width: 400px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
                h1 { color: #075e54; font-size: 30px; margin-bottom: 5px; }
                p { color: #666; font-size: 14px; margin-bottom: 25px; }
                input { width: 100%; padding: 15px; margin-bottom: 20px; border: 2px solid #ddd; border-radius: 12px; font-size: 18px; text-align: center; outline: none; transition: 0.3s; }
                input:focus { border-color: #25D366; }
                button { width: 100%; padding: 15px; background: #25D366; color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                #pairing-code { margin-top: 25px; padding: 20px; background: #f0fdf4; border: 2px dashed #25D366; border-radius: 12px; font-size: 35px; font-weight: 800; color: #075e54; display: none; letter-spacing: 4px; }
                .loader { color: #d9534f; margin-top: 15px; font-weight: bold; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Venocyber 👑</h1>
                <p>Auto Status View King</p>
                <input type="number" id="num" placeholder="255761070761">
                <button onclick="getPairingCode()" id="btn">Tengeneza Kodi</button>
                <div id="loader" class="loader">Inatengeneza... Subiri sekunde 15...</div>
                <div id="pairing-code"></div>
            </div>
            <script>
                async function getPairingCode() {
                    const n = document.getElementById('num').value;
                    const b = document.getElementById('btn');
                    const r = document.getElementById('pairing-code');
                    const l = document.getElementById('loader');
                    if(!n) return alert("Ingiza namba!");
                    b.disabled = true; l.style.display = "block"; r.style.display = "none";
                    try {
                        const res = await fetch('/pair?number=' + n);
                        const data = await res.json();
                        l.style.display = "none"; b.disabled = false;
                        if(data.code) { r.innerText = data.code; r.style.display = "block"; }
                        else { alert("WhatsApp Server Busy. Jaribu tena."); }
                    } catch(e) { alert("Server error!"); b.disabled = false; l.style.display = "none"; }
                }
            </script>
        </body>
        </html>
    `);
});

async function startBot(num = null, res = null) {
    if (num && fs.existsSync(SESSION_PATH)) { fs.removeSync(SESSION_PATH); }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        // Hapa tunatumia identity ya Safari on Mac ili WhatsApp wasishtuke
        browser: Browsers.macOS("Safari"),
        defaultQueryTimeoutMs: 60000,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // AUTO STATUS LOGIC
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (msg?.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(msg.key.remoteJid, { react: { text: "💚", key: msg.key } }, { statusJidList: [msg.key.participant, sock.user.id] });
        }
    });

    sock.ev.on('connection.update', async (u) => {
        if (u.connection === 'close') {
            const shouldReconnect = (u.lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (u.connection === 'open') {
            const myJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
            await sock.sendMessage(myJid, { text: `Dear ${sock.user.name || 'User'} Venocyber status View king 👑 connected successful Enjoy` });
        }
    });

    if (num && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(num);
                if (res && !res.headersSent) res.json({ code });
            } catch (e) { if (res && !res.headersSent) res.json({ error: true }); }
        }, 15000);
    }
}

app.get('/pair', (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: "No number" });
    startBot(number, res);
});

app.listen(PORT, () => {
    console.log(`Live on ${PORT}`);
    startBot();
});

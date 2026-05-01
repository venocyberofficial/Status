const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason, 
    Browsers,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const fs = require("fs-extra");
const qrcode = require("qrcode-terminal");

const app = express();
const PORT = process.env.PORT || 10000;
const SESSION_PATH = './auth_session';

app.use(express.json());

// UI KUBWA KWA AJILI YA SIMU
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { background: #075e54; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .box { background: white; padding: 40px 20px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
                h1 { color: #075e54; margin-bottom: 20px; font-size: 30px; }
                input { width: 100%; padding: 15px; margin-bottom: 20px; border: 2px solid #ddd; border-radius: 10px; font-size: 20px; text-align: center; box-sizing: border-box; }
                button { width: 100%; padding: 15px; background: #25d366; color: white; border: none; border-radius: 10px; font-size: 20px; font-weight: bold; cursor: pointer; }
                #code { margin-top: 25px; padding: 20px; background: #e7f3ef; border: 2px dashed #25d366; border-radius: 10px; font-size: 32px; font-weight: bold; display: none; color: #075e54; letter-spacing: 5px; }
                .msg { font-size: 14px; color: #666; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>Venocyber 👑</h1>
                <input type="number" id="num" placeholder="255761070761">
                <button onclick="get()">Pata Pairing Code</button>
                <div id="code"></div>
                <p class="msg" id="st">Baada ya kubonyeza, subiri sekunde 15.</p>
            </div>
            <script>
                async function get() {
                    const n = document.getElementById('num').value;
                    const c = document.getElementById('code');
                    const s = document.getElementById('st');
                    if(!n) return alert("Weka namba!");
                    s.innerText = "Inatengeneza... tafadhali subiri...";
                    const r = await fetch('/pair?number=' + n);
                    const d = await r.json();
                    if(d.code) { c.innerText = d.code; c.style.display = "block"; s.innerText = "Ingiza kodi hii kwenye WhatsApp sasa!"; }
                    else { s.innerText = "Imeshindwa. Jaribu tena au angalia Logs."; }
                }
            </script>
        </body>
        </html>
    `);
});

let sock;
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        browser: Browsers.macOS("Chrome"),
        printQRInTerminal: true // Hii itatoa QR Code kwenye Render Logs
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'open') {
            console.log("BOT IS ONLINE!");
            sock.sendMessage(sock.user.id.split(':')[0] + "@s.whatsapp.net", { text: "Dear " + (sock.user.name || "User") + " Venocyber status View king 👑 connected successful Enjoy" });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) start();
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (msg?.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(msg.key.remoteJid, { react: { text: "💚", key: msg.key } }, { statusJidList: [msg.key.participant, sock.user.id] });
        }
    });

    app.get('/pair', async (req, res) => {
        const number = req.query.number;
        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(number);
                    if (!res.headersSent) res.json({ code });
                } catch { if (!res.headersSent) res.json({ error: true }); }
            }, 15000);
        }
    });
}

app.listen(PORT, () => {
    console.log("Live on " + PORT);
    start();
});

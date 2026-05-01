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

const app = express();
const PORT = process.env.PORT || 10000;
const SESSION_PATH = './session_king_v4';

app.use(express.json());

// UI KUBWA NA RAHISI
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Venocyber Status King</title>
            <style>
                body { font-family: sans-serif; background: #075e54; margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: white; padding: 40px 20px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
                h1 { color: #075e54; font-size: 30px; margin-bottom: 20px; }
                input { width: 100%; padding: 15px; margin: 15px 0; border: 2px solid #ddd; border-radius: 10px; font-size: 18px; text-align: center; }
                button { width: 100%; padding: 15px; background: #25d366; color: white; border: none; border-radius: 10px; font-size: 20px; font-weight: bold; cursor: pointer; }
                #pairing-code { margin-top: 25px; padding: 20px; background: #e7f3ef; border: 2px dashed #25d366; border-radius: 10px; font-size: 32px; font-weight: bold; color: #075e54; display: none; letter-spacing: 5px; }
                .loader { color: #d9534f; margin-top: 15px; font-weight: bold; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Venocyber 👑</h1>
                <input type="number" id="num" placeholder="255761070761">
                <button onclick="getCode()" id="btn">Get Pairing Code</button>
                <div id="loader" class="loader">Inatengeneza... Subiri sekunde 15...</div>
                <div id="pairing-code"></div>
            </div>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value;
                    const b = document.getElementById('btn');
                    const r = document.getElementById('pairing-code');
                    const l = document.getElementById('loader');
                    if(!n) return alert("Weka namba!");
                    b.disabled = true; l.style.display = "block"; r.style.display = "none";
                    try {
                        const res = await fetch('/pair?number=' + n);
                        const data = await res.json();
                        l.style.display = "none"; b.disabled = false;
                        if(data.code) { r.innerText = data.code; r.style.display = "block"; }
                        else { alert("Failed. Try Again."); }
                    } catch(e) { alert("Error!"); b.disabled = false; l.style.display = "none"; }
                }
            </script>
        </body>
        </html>
    `);
});

let sock;
async function startBot(num = null, res = null) {
    if (num && fs.existsSync(SESSION_PATH)) { fs.removeSync(SESSION_PATH); }
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        logger: P({ level: 'silent' }),
        browser: Browsers.macOS("Safari"), // Hii identity ni imara kuliko zote sasa hivi
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // KAZI: AUTO STATUS VIEW & LIKE
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (msg?.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(msg.key.remoteJid, { react: { text: "💚", key: msg.key } }, { statusJidList: [msg.key.participant, sock.user.id] });
        }
    });

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
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
    console.log(`Port ${PORT}`);
    startBot();
});

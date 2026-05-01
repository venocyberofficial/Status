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

// MUONEKANO MKUBWA NA MZURI
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Venocyber Status King</title>
            <style>
                body { font-family: -apple-system, sans-serif; background: #075e54; margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: white; padding: 40px 20px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.4); }
                h1 { color: #075e54; margin: 0 0 10px; font-size: 32px; font-weight: 800; }
                input { width: 100%; padding: 18px; margin: 20px 0; border: 2px solid #eee; border-radius: 12px; font-size: 20px; text-align: center; box-sizing: border-box; outline: none; }
                input:focus { border-color: #25d366; }
                button { width: 100%; padding: 18px; background: #25d366; color: white; border: none; border-radius: 12px; font-size: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; }
                #pairing-code { margin-top: 30px; padding: 20px; background: #f0fdf4; border: 2px dashed #25d366; border-radius: 12px; font-size: 34px; font-weight: 900; color: #075e54; display: none; letter-spacing: 5px; }
                .loader { color: #d9534f; margin-top: 15px; font-weight: bold; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Venocyber 👑</h1>
                <p>Weka namba yako bila alama ya +</p>
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
                        else { alert("Imeshindwa! Jaribu tena."); }
                    } catch(e) { alert("Server error!"); b.disabled = false; l.style.display = "none"; }
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
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        // Hapa ndipo tunabadilisha identity kabisa
        browser: ["Chrome (Linux)", "", ""], 
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // AUTO STATUS LOGIC
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;
        if (msg.key.remoteJid === 'status@broadcast') {
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
    console.log(`Server is running on port ${PORT}`);
    startBot();
});

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
const SESSION_PATH = './session_status_king';

app.use(express.json());

// --- FRONTEND (MUONEKANO MKUBWA NA MZURI) ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="sw">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Venocyber Status King</title>
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #075e54; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
                .container { background: white; padding: 40px 25px; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.4); text-align: center; width: 100%; max-width: 450px; }
                h2 { color: #075e54; font-size: 28px; margin-bottom: 10px; }
                p { color: #555; font-size: 16px; line-height: 1.5; }
                input { width: 100%; padding: 18px; margin: 25px 0; border: 2px solid #eee; border-radius: 12px; font-size: 18px; text-align: center; outline: none; transition: 0.3s; }
                input:focus { border-color: #25d366; }
                button { width: 100%; padding: 18px; background: #25d366; color: white; border: none; border-radius: 12px; font-size: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 5px 15px rgba(37, 211, 102, 0.3); }
                #pairing-code { margin-top: 30px; padding: 20px; background: #f0fdf4; border: 2px dashed #25d366; border-radius: 12px; font-size: 32px; font-weight: bold; color: #075e54; display: none; letter-spacing: 5px; }
                .status-msg { margin-top: 15px; font-size: 14px; color: #d9534f; font-weight: 500; display: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Venocyber 👑</h2>
                <p>Ingiza namba yako kuanza ku-view status kiotomatiki.</p>
                <input type="number" id="number" placeholder="Mfano: 255761070761">
                <button onclick="getCode()" id="btn">Tengeneza Kodi</button>
                <div id="status" class="status-msg">Inatengeneza kodi... subiri sekunde 15...</div>
                <div id="pairing-code"></div>
            </div>
            <script>
                async function getCode() {
                    const num = document.getElementById('number').value;
                    const codeDiv = document.getElementById('pairing-code');
                    const status = document.getElementById('status');
                    const btn = document.getElementById('btn');
                    if(!num) return alert("Tafadhali weka namba!");
                    
                    btn.disabled = true;
                    status.style.display = "block";
                    codeDiv.style.display = "none";
                    
                    try {
                        const res = await fetch('/pair?number=' + num);
                        const data = await res.json();
                        status.style.display = "none";
                        btn.disabled = false;
                        if(data.code) {
                            codeDiv.innerText = data.code;
                            codeDiv.style.display = "block";
                        } else { alert("Imeshindwa! Jaribu tena."); }
                    } catch (e) { alert("Tatizo la mtandao!"); btn.disabled = false; }
                }
            </script>
        </body>
        </html>
    `);
});

let sock;

async function startStatusBot(num = null, res = null) {
    if (num && fs.existsSync(SESSION_PATH)) { await fs.removeSync(SESSION_PATH); }

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
        // HII NI MUHIMU SANA KUKWEPA "COULDN'T LINK DEVICE"
        browser: Browsers.ubuntu("Chrome"),
        mobile: true, 
        syncFullHistory: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;
        const jid = msg.key.remoteJid;

        if (jid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(jid, { react: { text: "💚", key: msg.key } }, { statusJidList: [msg.key.participant, sock.user.id] });
            console.log("✅ Status Viewed!");
        }
    });

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) startStatusBot();
        } else if (connection === 'open') {
            const myJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
            await sock.sendMessage(myJid, { text: `Dear ${sock.user.name || 'Mtumiaji'} Venocyber status View king 👑 connected successful Enjoy` });
        }
    });

    if (num && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(num);
                if (res && !res.headersSent) res.json({ code: code });
            } catch (e) { if (res && !res.headersSent) res.json({ error: "Fail" }); }
        }, 15000); 
    }
}

app.get('/pair', (req, res) => {
    const num = req.query.number;
    if (!num) return res.json({ error: "No number" });
    startStatusBot(num, res);
});

app.listen(PORT, () => {
    console.log(`Server Live on ${PORT}`);
    startStatusBot(); 
});

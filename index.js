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

// UI Dashboard - Imeboreshwa iwe kubwa na rahisi kutumia
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Venocyber Status King</title>
            <style>
                body { font-family: sans-serif; background: #075e54; margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                .card { background: white; padding: 40px 20px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
                h1 { color: #075e54; margin-bottom: 20px; font-size: 28px; }
                input { width: 100%; padding: 15px; margin: 20px 0; border: 2px solid #ddd; border-radius: 10px; font-size: 18px; text-align: center; box-sizing: border-box; }
                button { width: 100%; padding: 15px; background: #25d366; color: white; border: none; border-radius: 10px; font-size: 20px; font-weight: bold; cursor: pointer; transition: 0.3s; }
                button:disabled { background: #ccc; }
                #result { margin-top: 25px; padding: 15px; background: #e7f3ef; border: 2px dashed #25d366; border-radius: 10px; font-size: 30px; font-weight: bold; color: #075e54; display: none; letter-spacing: 5px; }
                .info { margin-top: 15px; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Venocyber 👑</h1>
                <p>Ingiza namba bila + (Mfano: 255761070761)</p>
                <input type="number" id="num" placeholder="255761070761">
                <button onclick="getPairingCode()" id="btn">Get Pairing Code</button>
                <div id="result"></div>
                <p class="info" id="msg">Subiri kidogo baada ya kubonyeza...</p>
            </div>
            <script>
                async function getPairingCode() {
                    const n = document.getElementById('num').value;
                    const b = document.getElementById('btn');
                    const r = document.getElementById('result');
                    const m = document.getElementById('msg');
                    if(!n) return alert("Weka namba!");
                    b.disabled = true; m.innerText = "Inatengeneza... subiri sekunde 15";
                    try {
                        const res = await fetch('/pair?number=' + n);
                        const data = await res.json();
                        if(data.code) {
                            r.innerText = data.code; r.style.display = "block";
                            m.innerText = "Ingiza kodi hii kwenye WhatsApp yako sasa.";
                        } else { alert("Ilikatika, jaribu tena."); b.disabled = false; }
                    } catch(e) { alert("Error!"); b.disabled = false; }
                }
            </script>
        </body>
        </html>
    `);
});

let sock;
async function startBot(num = null, res = null) {
    // Futa session ya zamani kama tunaomba kodi mpya
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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: true
    });

    sock.ev.on('creds.update', saveCreds);

    // Kazi ya Bot: Auto Status View
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
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
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

// Port listener muhimu kwa Render
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startBot();
});

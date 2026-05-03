const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    DisconnectReason,
    Browsers
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 10000;

let sock;

// Logic ya kuzuia seva isilale (Self-Ping)
const RENDER_URL = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null;

async function startVenocyber() {
    if (!fs.existsSync('./session')) {
        fs.mkdirSync('./session');
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
        version,
        syncFullHistory: false, // MUHIMU: Inazuia bot ku-crash kwenye Render
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('✅ VENOCYBER KING IS LIVE!');
            const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.sendMessage(myJid, { 
                text: `Dear ${sock.user.name || 'User'} Venocyber status view king 👑 is connected successful!` 
            });
        }

        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("♻️ Reconnecting...");
                startVenocyber();
            }
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;
            if (msg.key.remoteJid === 'status@broadcast') {
                await sock.readMessages([msg.key]);
                console.log(`✅ Viewed Status: ${msg.pushName || 'Private'}`);
            }
        } catch (e) {}
    });
}

startVenocyber();

// Keep-Alive Loop: Hii inapiga link yako kila baada ya dakika 4
setInterval(() => {
    if (RENDER_URL) {
        axios.get(RENDER_URL).then(() => {
            console.log("⚡ Keep-Alive: Seva iko macho!");
        }).catch(() => {});
    }
}, 4 * 60 * 1000);

// --- WEB INTERFACE ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="sw">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venocyber Status King</title>
        <style>
            body { background: radial-gradient(circle, #2c2c2c 0%, #000000 100%); color: #FFD700; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .main-card { background: rgba(0, 0, 0, 0.9); border: 4px solid #FFD700; border-radius: 40px; padding: 50px 20px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 0 30px rgba(255, 215, 0, 0.4); }
            h1 { font-size: 2.2rem; margin-bottom: 10px; }
            input { width: 80%; padding: 15px; font-size: 1.2rem; border-radius: 10px; border: 2px solid #FFD700; background: #111; color: #fff; margin-bottom: 20px; text-align: center; }
            button { width: 85%; padding: 15px; font-size: 1.2rem; background: #FFD700; color: #000; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; }
            button:hover { background: #fff; transform: scale(1.02); }
            #code-box { margin-top: 25px; padding: 15px; border: 2px dashed #FFD700; border-radius: 10px; font-size: 2rem; font-weight: bold; color: #fff; display: none; background: #222; letter-spacing: 5px; }
            .load { color: #fff; display: none; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="main-card">
            <h1>👑 VENOCYBER</h1>
            <p>STATUS VIEW KING 👑</p>
            <input type="number" id="phoneNum" placeholder="255625774543">
            <button onclick="requestPairing()">PATA KODI</button>
            <div id="loading" class="load">Inatengeneza kodi...</div>
            <div id="code-box"></div>
        </div>
        <script>
            async function requestPairing() {
                const num = document.getElementById('phoneNum').value;
                const box = document.getElementById('code-box');
                const load = document.getElementById('loading');
                if(!num) return alert("Ingiza namba!");
                load.style.display = "block";
                box.style.display = "none";
                try {
                    const res = await fetch('/pair?number=' + num);
                    const data = await res.json();
                    load.style.display = "none";
                    if(data.code) {
                        box.innerText = data.code;
                        box.style.display = "block";
                    } else { alert("Jaribu tena!"); }
                } catch (e) { load.style.display = "none"; alert("Error!"); }
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!sock) return res.json({ error: "Initializing..." });
    try {
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (e) {
        res.json({ error: "Failed" });
    }
});

app.listen(PORT, () => console.log(`🚀 Seva imewaka kwenye Port ${PORT}`));

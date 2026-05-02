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
const app = express();
const PORT = process.env.PORT || 3000;

let sock;

async function startVenocyber() {
    // 1. Kuhifadhi session kwa usalama
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
        // Maboresho ya kuvuta contacts zote
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('✅ VENOCYBER KING IS LIVE!');
            
            // Subiri kidogo ili data zipakiwe
            await delay(5000);
            
            const pushName = sock.user.name || "Mtumiaji";
            const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // Ujumbe wa Feedback kama ulivyoagiza
            await sock.sendMessage(myJid, { 
                text: `Dear ${pushName} Venocyber status view king 👑 is connected successful Congratulations` 
            });
        }

        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVenocyber();
        }
    });

    // --- LOGIC YA AUTO STATUS VIEW ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;

            if (msg.key.remoteJid === 'status@broadcast') {
                // Inasoma status papo hapo
                await sock.readMessages([msg.key]);
                console.log(`✅ Imesoma Status ya: ${msg.pushName || 'Siri'}`);
            }
        } catch (e) {
            // Unasubiri error bila kuzima bot
        }
    });
}

startVenocyber();

// --- PREMIUM GOLD WEB INTERFACE ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="sw">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venocyber Status King</title>
        <style>
            body {
                background: radial-gradient(circle, #2c2c2c 0%, #000000 100%);
                color: #FFD700;
                font-family: 'Trebuchet MS', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .main-card {
                background: rgba(0, 0, 0, 0.9);
                border: 4px solid #FFD700;
                border-radius: 40px;
                padding: 60px 30px;
                width: 95%;
                max-width: 480px;
                text-align: center;
                box-shadow: 0 0 40px rgba(255, 215, 0, 0.6);
            }
            h1 { font-size: 2.8rem; margin-bottom: 5px; letter-spacing: -1px; }
            .subtitle { color: #fff; font-size: 1.1rem; margin-bottom: 40px; opacity: 0.8; }
            input {
                width: 100%;
                padding: 20px;
                font-size: 1.4rem;
                border-radius: 20px;
                border: 2px solid #FFD700;
                background: #111;
                color: #fff;
                margin-bottom: 25px;
                text-align: center;
            }
            button {
                width: 100%;
                padding: 20px;
                font-size: 1.4rem;
                background: linear-gradient(45deg, #FFD700, #DAA520);
                color: #000;
                border: none;
                border-radius: 20px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 10px 20px rgba(0,0,0,0.5);
                transition: 0.3s;
            }
            button:hover {
                transform: scale(1.03);
                background: #fff;
            }
            #code-box {
                margin-top: 35px;
                padding: 25px;
                border: 3px dashed #FFD700;
                border-radius: 15px;
                font-size: 2.5rem;
                font-weight: 900;
                color: #fff;
                display: none;
                background: #222;
                letter-spacing: 8px;
            }
            .loading { font-size: 1rem; color: #fff; display: none; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="main-card">
            <h1>👑 VENOCYBER</h1>
            <div class="subtitle">STATUS VIEW KING 👑</div>
            <input type="number" id="phoneNum" placeholder="255761070761">
            <button onclick="requestPairing()">GET PAIRING CODE</button>
            <div id="loading-txt" class="loading">Inatafuta code kutoka WhatsApp...</div>
            <div id="code-box"></div>
        </div>

        <script>
            async function requestPairing() {
                const num = document.getElementById('phoneNum').value;
                const box = document.getElementById('code-box');
                const load = document.getElementById('loading-txt');
                
                if(!num) return alert("Tafadhali ingiza namba ya simu!");
                
                load.style.display = "block";
                box.style.display = "none";

                try {
                    const response = await fetch('/pair?number=' + num);
                    const data = await response.json();
                    load.style.display = "none";
                    if(data.code) {
                        box.innerText = data.code;
                        box.style.display = "block";
                    } else {
                        alert("Imeshindikana! Hakikisha namba haina '+'");
                    }
                } catch (e) {
                    load.style.display = "none";
                    alert("Server imeshindwa kuunganisha.");
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/pair', async (req, res) => {
    let num = req.query.number;
    try {
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (e) {
        res.json({ error: "Failed" });
    }
});

app.listen(PORT, () => console.log(`Bot Running on Port ${PORT}`));

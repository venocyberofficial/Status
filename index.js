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
    // Hakikisha folder la session lipo kwa ajili ya kuhifadhi login
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
        browser: Browsers.macOS("Safari"), // Inasaidia kuifanya bot ionekane kama browser ya kawaida
        version
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log('✅ Venocyber King Connected!');
            
            // Subiri sekunde kidogo ili kupata data za mtumiaji
            await delay(3000);
            
            const pushName = sock.user.name || "Mtumiaji";
            const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // Feedback Message
            await sock.sendMessage(myJid, { 
                text: `Dear ${pushName} Venocyber status view king 👑 is connected successful Congratulations` 
            });
        }

        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVenocyber();
        }
    });

    // --- AUTO STATUS VIEW LOGIC ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message) return;
        
        // Kama ujumbe unatoka kwenye status broadcast
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            console.log(`✅ Viewed Status from: ${msg.pushName || 'Contact'}`);
        }
    });
}

// Anzisha Bot
startVenocyber();

// --- GOLD INTERFACE (UI) ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="sw">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venocyber Status King</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background: linear-gradient(135deg, #000000 0%, #332b00 100%);
                color: #FFD700;
                font-family: 'Arial', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .container {
                width: 90%;
                max-width: 450px;
                background: rgba(0, 0, 0, 0.8);
                border: 3px solid #FFD700;
                border-radius: 20px;
                padding: 40px 20px;
                text-align: center;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
            }
            h1 { font-size: 2rem; margin-bottom: 10px; text-shadow: 0 0 10px #FFD700; }
            p { color: #fff; margin-bottom: 30px; font-size: 0.9rem; }
            input {
                width: 100%;
                padding: 15px;
                border-radius: 10px;
                border: 1px solid #FFD700;
                background: #111;
                color: #fff;
                font-size: 1.1rem;
                margin-bottom: 20px;
                text-align: center;
            }
            button {
                width: 100%;
                padding: 15px;
                background: #FFD700;
                color: #000;
                border: none;
                border-radius: 10px;
                font-size: 1.2rem;
                font-weight: bold;
                cursor: pointer;
                transition: 0.3s;
            }
            button:hover { background: #fff; transform: translateY(-2px); }
            #pairingCode {
                margin-top: 25px;
                padding: 15px;
                border: 2px dashed #FFD700;
                font-size: 1.8rem;
                font-weight: bold;
                color: #00FF00;
                display: none;
                background: #222;
            }
            .loader { color: #fff; font-style: italic; display: none; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>👑 VENOCYBER</h1>
            <p>STATUS VIEW KING 👑</p>
            <input type="number" id="phone" placeholder="255761070761">
            <button onclick="generateCode()">PATA PAIRING CODE</button>
            <div id="loader" class="loader">Tafadhali subiri, inatengeneza...</div>
            <div id="pairingCode"></div>
        </div>

        <script>
            async function generateCode() {
                const num = document.getElementById('phone').value;
                const codeDiv = document.getElementById('pairingCode');
                const loader = document.getElementById('loader');
                
                if(!num) return alert("Ingiza namba ya simu!");
                
                loader.style.display = "block";
                codeDiv.style.display = "none";

                try {
                    const response = await fetch('/get-code?number=' + num);
                    const data = await response.json();
                    loader.style.display = "none";
                    if(data.code) {
                        codeDiv.innerText = data.code;
                        codeDiv.style.display = "block";
                    } else {
                        alert("Imeshindikana. Jaribu tena!");
                    }
                } catch (e) {
                    loader.style.display = "none";
                    alert("Server error. Hakikisha Render ipo Online.");
                }
            }
        </script>
    </body>
    </html>
    `);
});

// Endpoint ya kutengeneza code
app.get('/get-code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.json({ error: "No number" });
    try {
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (e) {
        res.json({ error: "Goma" });
    }
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

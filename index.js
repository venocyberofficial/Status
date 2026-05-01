const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

let sock;

async function startVenocyber() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Venocyber King", "Safari", "1.0.0"],
        version
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            // Hapa bot inasoma jina la akaunti iliyounganishwa
            const botNumber = sock.user.id.split(':')[0];
            const pushName = sock.user.name || "Mtumiaji";
            
            console.log(`Bot imeunganishwa kwa: ${pushName}`);

            // Kutuma ujumbe wa Feedback kama ulivyoagiza
            await sock.sendMessage(sock.user.id, { 
                text: `Dear ${pushName} Venocyber status view king 👑 is connected successful Congratulations` 
            });
        }

        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVenocyber();
        }
    });

    // AUTO STATUS VIEW
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
        }
    });
}

startVenocyber();

// INTERFACE YA DHAHABU (GOLD & LARGE UI)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="sw">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venocyber King - Status View</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background: linear-gradient(180deg, #000 0%, #1a1a00 100%);
                color: #FFD700;
                font-family: 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                overflow: hidden;
            }
            .main-box {
                width: 90%;
                max-width: 450px;
                background: rgba(0,0,0,0.9);
                border: 4px solid #FFD700;
                border-radius: 30px;
                padding: 50px 20px;
                text-align: center;
                box-shadow: 0 0 50px rgba(255, 215, 0, 0.3);
            }
            h1 { font-size: 2.5rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; }
            .sub-txt { color: #fff; margin-bottom: 40px; font-weight: 300; }
            input {
                width: 100%;
                padding: 18px;
                background: #111;
                border: 2px solid #FFD700;
                border-radius: 15px;
                color: #fff;
                font-size: 1.2rem;
                margin-bottom: 25px;
                outline: none;
                text-align: center;
            }
            button {
                width: 100%;
                padding: 18px;
                background: #FFD700;
                color: #000;
                border: none;
                border-radius: 15px;
                font-size: 1.3rem;
                font-weight: bold;
                cursor: pointer;
                transition: 0.3s ease;
                box-shadow: 0 5px 15px rgba(218, 165, 32, 0.4);
            }
            button:hover { background: #fff; transform: translateY(-3px); }
            #codeDisplay {
                margin-top: 30px;
                padding: 20px;
                background: #222;
                border-radius: 15px;
                font-size: 2rem;
                color: #fff;
                border: 2px dashed #FFD700;
                display: none;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="main-box">
            <h1>👑 VENOCYBER</h1>
            <p class="sub-txt">STATUS VIEW KING 👑</p>
            <input type="number" id="numInput" placeholder="255761070761">
            <button onclick="fetchCode()">Tengeneza Pairing Code</button>
            <div id="codeDisplay"></div>
        </div>

        <script>
            async function fetchCode() {
                const namba = document.getElementById('numInput').value;
                const box = document.getElementById('codeDisplay');
                if(!namba) return alert("Weka namba!");
                
                box.style.display = "block";
                box.innerText = "IKIDOWNLOAD...";
                
                try {
                    const res = await fetch('/get-pair?number=' + namba);
                    const data = await res.json();
                    box.innerText = data.code || "JARIBU TENA!";
                } catch (e) {
                    box.innerText = "ERROR!";
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/get-pair', async (req, res) => {
    let namba = req.query.number;
    try {
        let code = await sock.requestPairingCode(namba);
        res.json({ code: code });
    } catch (e) {
        res.json({ error: "Goma" });
    }
});

app.listen(PORT);

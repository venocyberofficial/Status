const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        version
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            const user = sock.user.id.split(':')[0];
            await sock.sendMessage(sock.user.id, { 
                text: `Dear ${sock.user.name || 'User'}, Venocyber Status View King 👑 is connected successful Congratulations` 
            });
        }
        if (connection === 'close') startVenocyber();
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
        }
    });
}

startVenocyber();

// WEB INTERFACE
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Venocyber Status View King</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { background: #000; color: #FFD700; font-family: sans-serif; text-align: center; padding-top: 50px; }
            .card { border: 2px solid #FFD700; padding: 20px; border-radius: 15px; display: inline-block; background: #111; box-shadow: 0 0 15px #FFD700; width: 90%; max-width: 400px; }
            input { width: 80%; padding: 10px; margin: 15px 0; border-radius: 5px; border: 1px solid #FFD700; background: #222; color: #fff; }
            button { background: #FFD700; color: #000; padding: 10px 20px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
            #result { margin-top: 20px; font-weight: bold; font-size: 1.2rem; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>👑 VENOCYBER STATUS VIEW KING 👑</h2>
            <input type="number" id="num" placeholder="255767000000">
            <button onclick="getCode()">Tengeneza Pairing Code</button>
            <div id="result"></div>
        </div>
        <script>
            async function getCode() {
                const num = document.getElementById('num').value;
                const resDiv = document.getElementById('result');
                if(!num) return alert("Weka namba!");
                resDiv.innerText = "Tafadhali subiri...";
                try {
                    const response = await fetch('/pair?number=' + num);
                    const data = await response.json();
                    resDiv.innerText = data.code || "Jaribu tena!";
                } catch (e) { resDiv.innerText = "Error! Hakikisha Render imemaliza ku-deploy."; }
            }
        </script>
    </body>
    </html>`);
});

app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.json({ error: "No number" });
    try {
        if (!sock.authState.creds.registered) {
            let code = await sock.requestPairingCode(num);
            res.json({ code: code });
        } else {
            res.json({ code: "Tayari umeunganishwa!" });
        }
    } catch (e) {
        res.json({ error: "Server Busy" });
    }
});

app.listen(PORT);

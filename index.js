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
        // Hii sehemu ndiyo muhimu kwa ajili ya pairing code kukubali
        browser: Browsers.ubuntu("Chrome"), 
        version
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            const pushName = sock.user.name || "Mtumiaji";
            console.log(`Imeunganishwa kikamilifu kwa: ${pushName}`);

            await sock.sendMessage(sock.user.id, { 
                text: `Dear ${pushName} Venocyber status view king 👑 is connected successful Congratulations` 
            });
        }

        if (connection === 'close') {
            let shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVenocyber();
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
        }
    });
}

startVenocyber();

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="sw">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venocyber King - Fix</title>
        <style>
            body { background: #000; color: #FFD700; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
            .box { border: 3px solid #FFD700; padding: 40px; border-radius: 20px; background: #111; width: 90%; max-width: 400px; box-shadow: 0 0 20px #FFD700; }
            input { width: 100%; padding: 15px; margin: 20px 0; border-radius: 10px; border: 1px solid #FFD700; background: #000; color: #fff; font-size: 1.2rem; }
            button { width: 100%; padding: 15px; background: #FFD700; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 1.1rem; }
            #display { margin-top: 20px; font-size: 1.5rem; font-weight: bold; color: #fff; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>👑 VENOCYBER KING</h2>
            <input type="number" id="namba" placeholder="255761070761">
            <button onclick="pataCode()">Pata Pairing Code</button>
            <div id="display"></div>
        </div>
        <script>
            async function pataCode() {
                const n = document.getElementById('namba').value;
                const d = document.getElementById('display');
                if(!n) return alert("Weka namba!");
                d.innerText = "Tengeneza...";
                try {
                    const r = await fetch('/pair-now?num=' + n);
                    const res = await r.json();
                    d.innerText = res.code || "JARIBU TENA";
                } catch(e) { d.innerText = "ERROR"; }
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/pair-now', async (req, res) => {
    let num = req.query.num;
    try {
        // Hapa tunaomba code mpya kila wakati
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (e) {
        res.json({ error: "Goma" });
    }
});

app.listen(PORT);

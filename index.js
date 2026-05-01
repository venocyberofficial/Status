const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const fs = require("fs-extra");

const app = express();
const PORT = process.env.PORT || 10000;
const SESSION_PATH = './session_status_king';

app.use(express.json());

// FRONTEND
app.get('/', (req, res) => {
    res.send(`<body style="background:#075e54;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
        <div style="background:white;padding:30px;border-radius:15px;color:#333;text-align:center;width:320px;">
            <h2>Venocyber Status King 👑</h2>
            <input type="number" id="num" placeholder="255761070761" style="width:100%;padding:12px;margin:15px 0;border:1px solid #ddd;border-radius:8px;">
            <button onclick="pair()" style="width:100%;padding:12px;background:#25d366;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Get Pairing Code</button>
            <div id="cp" style="margin-top:20px;padding:10px;background:#e7f3ef;border-radius:8px;font-size:22px;font-weight:bold;display:none;letter-spacing:3px;"></div>
            <p id="ld" style="display:none;color:red;font-size:12px;">Processing... Wait 15 seconds</p>
        </div>
        <script>
            async function pair() {
                const n = document.getElementById('num').value;
                const cp = document.getElementById('cp');
                const ld = document.getElementById('ld');
                if(!n) return alert("Weka namba!");
                ld.style.display="block"; cp.style.display="none";
                const r = await fetch('/pair?number='+n);
                const d = await r.json();
                ld.style.display="none";
                if(d.code) { cp.innerText=d.code; cp.style.display="block"; }
                else { alert("Error. Try again."); }
            }
        </script>
    </body>`);
});

async function startStatusBot(num = null, res = null) {
    if (num && fs.existsSync(SESSION_PATH)) { fs.removeSync(SESSION_PATH); }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "121.0.6167.85"],
        // HIZI SETTINGS NI MUHIMU ILI STATUS ZIONEKANE
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
    });

    sock.ev.on('creds.update', saveCreds);

    // MFUMO WA KUSOMA STATUS (Force Read)
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;
        
        const jid = msg.key.remoteJid;

        // Kama ni status
        if (jid === 'status@broadcast') {
            try {
                // 1. Mark as Read (View)
                await sock.readMessages([msg.key]);
                
                // 2. Add Reaction (Like)
                await sock.sendMessage(jid, { 
                    react: { text: "💚", key: msg.key } 
                }, { statusJidList: [msg.key.participant, sock.user.id] });
                
                console.log(`✅ Status Viewed & Liked from: ${msg.pushName || msg.key.participant}`);
            } catch (err) {
                console.log("View Error: ", err.message);
            }
        }
    });

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            const code = lastDisconnect.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) startStatusBot();
        } else if (connection === 'open') {
            console.log("✅ Status King is Online!");
            const myJid = sock.user.id.split(':')[0] + "@s.whatsapp.net";
            await sock.sendMessage(myJid, { text: `Dear ${sock.user.name || 'User'} Venocyber status View king 👑 connected successful Enjoy` });
        }
    });

    if (num && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(num);
                if (res && !res.headersSent) res.json({ code: code });
            } catch (e) {
                if (res && !res.headersSent) res.json({ error: "Try Again" });
            }
        }, 15000); // Tupa 15 seconds kwa Render
    }
}

app.get('/pair', (req, res) => {
    const num = req.query.number;
    if (!num) return res.json({ error: "No number" });
    startStatusBot(num, res);
});

app.listen(PORT, () => {
    console.log(`Live on ${PORT}`);
    startStatusBot(); 
});

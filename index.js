const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    DisconnectReason,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

let sock;
const RENDER_URL = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null;

async function startVenocyber() {
    if (!fs.existsSync('./session')) {
        fs.mkdirSync('./session');
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        // Hapa tumerudisha mipangilio ya mwanzo ili WhatsApp isikatae kodi
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        generateHighQualityLinkPreview: true,
        syncFullHistory: false, // Inazuia bot kusoma status za zamani
        markOnlineOnConnect: true,
        getMessage: async (key) => {
            return { conversation: 'status' };
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ VENOCYBER KING IS LIVE AND READY!');
            try {
                const myJid = jidNormalizedUser(sock.user.id);
                await sock.sendMessage(myJid, {
                    text: `👑 *Venocyber Status King Active!*\n\n✅ Bot ipo hewani sasa, inasoma (view) na kulike statuses automatically.`
                });
            } catch (e) {
                console.log("Haikuweza kutuma ujumbe wa utambulisho.");
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`⚠️ Connection closed. Reconnecting... (Code: ${statusCode})`);

            if (shouldReconnect) {
                setTimeout(() => startVenocyber(), 5000);
            } else {
                console.log('❌ Bot imetolewa (Logged Out). Futa folder la session na uunganishe upya.');
            }
        }
    });

    // MFUMO WA KUDAKA NA KULIKE STATUS
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        // Inaruhusu tu meseji mpya zinazoingia kuepuka bot kukwama (rate-limit)
        if (chatUpdate.type !== 'notify') return;

        const messages = chatUpdate.messages;
        if (!messages || messages.length === 0) return;

        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                
                // Inazuia bot kujisomea / kureact kwenye status zako mwenyewe
                if (msg.key.fromMe) continue;

                // Angalia kama ni Status
                if (msg.key.remoteJid === 'status@broadcast') {
                    const senderJid = msg.key.participant;
                    if (!senderJid) continue;

                    const senderName = msg.pushName || 'WhatsApp User';
                    console.log(`📩 Status mpya imedakwa kutoka kwa: ${senderName}`);

                    // 1. READ / VIEW STATUS (Njia mpya na salama)
                    await sock.readMessages([msg.key]);
                    console.log(`👀 Imemark STATUS kuwa VIEWED: ${senderName}`);

                    // Subiri sekunde 2.5
                    await delay(2500);

                    // 2. LIKE STATUS (REACTION)
                    const emojis = ['❤️', '🔥', '👑', '💯', '✨', '💖', '🤍', '🌹'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

                    await sock.sendMessage(
                        'status@broadcast',
                        {
                            react: {
                                text: randomEmoji,
                                key: msg.key
                            }
                        },
                        { statusJidList: [senderJid] }
                    );
                    console.log(`👍 Imereact ${randomEmoji} kwa status ya: ${senderName}`);
                }
            } catch (error) {
                console.error("❌ Error kwenye kusoma status:", error.message);
            }
        }
    });
}

startVenocyber();

// Keep-Alive Loop
setInterval(() => {
    if (RENDER_URL) {
        axios.get(RENDER_URL).catch(() => {});
    }
}, 4 * 60 * 1000);

// --- WEB INTERFACE ---
app.use(express.json());

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
            <p>STATUS VIEW & LIKE KING 👑</p>
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
                if(!num) return alert("Ingiza namba ya simu!");
                load.style.display = "block";
                box.style.display = "none";
                try {
                    const res = await fetch('/pair?number=' + num);
                    const data = await res.json();
                    load.style.display = "none";
                    if(data.code) {
                        box.innerText = data.code;
                        box.style.display = "block";
                    } else { alert(data.error || "Jaribu tena!"); }
                } catch (e) { load.style.display = "none"; alert("Error ya mtandao!"); }
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/pair', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.json({ error: "Tafadhali weka namba!" });
    num = num.replace(/[^0-9]/g, '');
    if (!sock) return res.json({ error: "Bot bado inaanza..." });
    try {
        if (sock.authState.creds.registered) {
            return res.json({ error: "Tayari imeunganishwa na WhatsApp!" });
        }
        await delay(1500);
        let code = await sock.requestPairingCode(num);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        res.json({ code: code });
    } catch (e) {
        res.json({ error: "Haikuweza kutengeneza kodi" });
    }
});

app.listen(PORT, () => console.log(`🚀 Server listening on Port ${PORT}`));

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

// Hii itatumia jina la app yako ya Render kiotomatiki kwa ajili ya Self-Ping
const RENDER_URL = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null;

app.get('/', (req, res) => {
    res.send(`<div style="font-family:sans-serif; text-align:center; margin-top:50px;">
        <h1 style="color:#00a884;">Venocyber Status Bot is Running! 🚀</h1>
        <p>Angalia Logs za Render kupata Pairing Code yako.</p>
    </div>`);
});

app.listen(PORT, () => console.log(`Seva imewaka Port ${PORT}`));

// --- ANTI-SLEEP (Inazuia bot isizime) ---
setInterval(() => {
    if (RENDER_URL) {
        axios.get(RENDER_URL).then(() => {
            console.log("⚡ Ping: Bot bado yuko macho!");
        }).catch(() => {});
    }
}, 4 * 60 * 1000); 

// --- BOT MAIN FUNCTION ---
async function startVenocyber() {
    // Tumia jina jipya la session kukwepa "Couldn't link device"
    const { state, saveCreds } = await useMultiFileAuthState('v_status_final_v2');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        // Browser config ya kisasa ili WhatsApp isikatae
        browser: ["Ubuntu", "Chrome", "121.0.6167.85"] 
    });

    // --- PAIRING CODE LOGIC (Angalia kwenye Logs) ---
    if (!sock.authState.creds.registered) {
        const myNumber = "255625774543"; // Namba yako ya WhatsApp
        console.log(`🚀 Inatengeneza Pairing Code kwa namba: ${myNumber}...`);
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(myNumber);
                console.log(`\n====================================`);
                console.log(`   PAIRING CODE YAKO NI: ${code}`);
                console.log(`====================================\n`);
            } catch (err) {
                console.log("❌ Imeshindwa kupata kodi. Restart bot.");
            }
        }, 10000); 
    }

    sock.ev.on('creds.update', saveCreds);

    // --- STATUS LOGIC (View & Like) ---
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const jid = msg.key.remoteJid;

        if (jid === 'status@broadcast') {
            try {
                await sock.readMessages([msg.key]); // Auto View
                // Auto Reaction (Like)
                await sock.sendMessage(jid, { 
                    react: { text: "💚", key: msg.key } 
                }, { statusJidList: [msg.key.participant, sock.user.id] }); 
                
                console.log(`✅ Status ya ${msg.key.participant.split('@')[0]} imewekwa reaction!`);
            } catch (e) {
                console.log("Status Error");
            }
        }
    });

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVenocyber();
        } else if (connection === 'open') {
            console.log("✅ BOT IMECONNECT NA IPO TAYARI KAZINI!");
        }
    });
}

startVenocyber();

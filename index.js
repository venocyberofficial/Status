const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    PHONENUMBER_MCC
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// HTML Interface yenye Gold Theme
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Venocyber Status View King</title>
        <style>
            body {
                background: linear-gradient(135deg, #000000 0%, #434343 100%);
                color: #FFD700;
                font-family: 'Arial', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
            }
            .container {
                border: 2px solid #FFD700;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
                text-align: center;
                background: rgba(0, 0, 0, 0.8);
            }
            h1 { font-size: 24px; margin-bottom: 20px; text-shadow: 2px 2px #000; }
            input {
                padding: 10px;
                width: 80%;
                border-radius: 5px;
                border: 1px solid #FFD700;
                background: #222;
                color: #fff;
                margin-bottom: 20px;
            }
            button {
                padding: 10px 20px;
                background: #FFD700;
                color: #000;
                border: none;
                border-radius: 5px;
                font-weight: bold;
                cursor: pointer;
                transition: 0.3s;
            }
            button:hover { background: #fff; box-shadow: 0 0 10px #FFD700; }
            #pairCode {
                margin-top: 20px;
                font-size: 22px;
                letter-spacing: 2px;
                font-weight: bold;
                color: #fff;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>👑 VENOCYBER STATUS VIEW KING 👑</h1>
            <p>Ingiza namba yako (mfano: 2557XXXXXXXX)</p>
            <input type="text" id="number" placeholder="255767000000">
            <br>
            <button onclick="getPairingCode()">Tengeneza Pairing Code</button>
            <div id="pairCode"></div>
        </div>

        <script>
            async function getPairingCode() {
                const num = document.getElementById('number').value;
                const display = document.getElementById('pairCode');
                if(!num) return alert("Tafadhali ingiza namba!");
                display.innerText = "Inatengeneza...";
                
                try {
                    const response = await fetch('/code?number=' + num);
                    const data = await response.json();
                    display.innerText = "CODE YAKO: " + data.code;
                } catch (e) {
                    display.innerText = "Jaribu tena baadaye.";
                }
            }
        </script>
    </body>
    </html>
    `);
});

// Logic ya WhatsApp
async function startVenocyber() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    const client = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Endpoint ya kutoa Pairing Code
    app.get('/code', async (req, res) => {
        let phoneNumber = req.query.number.replace(/[^0-9]/g, '');
        if (!client.authState.creds.registered) {
            let code = await client.requestPairingCode(phoneNumber);
            res.json({ code: code });
        } else {
            res.json({ code: "Tayari umeunganishwa!" });
        }
    });

    client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('Bot Imeunganishwa!');
            const user = client.user.name || "Mtumiaji";
            await client.sendMessage(client.user.id, { 
                text: `Dear ${user}, Venocyber Status View King 👑 is connected successful Congratulations` 
            });
        }
        if (connection === 'close') {
            startVenocyber(); // Iki-disconnect, iwashe tena
        }
    });

    client.ev.on('creds.update', saveCreds);

    // AUTO STATUS VIEW LOGIC
    client.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.key.fromMe && msg.key.remoteJid === 'status@broadcast') {
                await client.readMessages([msg.key]);
                console.log(`Status ya ${msg.pushName} imewekwa 'Seen' ✅`);
            }
        } catch (e) {
            console.error(e);
        }
    });
}

startVenocyber();

app.listen(PORT, () => {
    console.log(`Server inatumika kwenye port ${PORT}`);
});

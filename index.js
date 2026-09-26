const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");

const app = express(); 
const PORT = process.env.PORT || 10000;

// =========================================================================
// 🛠️ SEHEMU YA MA-KEY YAKO YOTE (WEKA HAPA MOJA KWA MOJA)
// =========================================================================
const RAPIDAPI_KEY = ""; 
const MONGO_URL = "mongodb+srv://venocyber:Njombe%402022@cluster0.boub2ld.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; 
const OWNER_NUMBER = "255761070761";
const OWNER_JID = `${OWNER_NUMBER}@s.whatsapp.net`;
// =========================================================================

// --- SERVER SETUP ---
const MY_RENDER_URL = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null;

app.get("/", (req, res) => res.send("Venocyber Ultra Pro Multilingual is Online! 🌍🚀"));
app.listen(PORT, () => console.log(`Seva imewaka kwenye Port ${PORT}`));

// Keep Alive Logic (Kuzuia Render isilale)
setInterval(() => {
    if (MY_RENDER_URL) {
        axios.get(MY_RENDER_URL).then(() => console.log("Self-Ping: Active ⚡")).catch(() => {});
    }
}, 4 * 60 * 1000);

// --- UTILITY FUNCTIONS (MA-EXTRACTOR YA LINK) ---

// 1. YouTube ID Extractor
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 2. TikTok ID Extractor
async function getTikTokId(url) {
    try {
        if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
            const res = await axios.get(url, { maxRedirects: 5 });
            url = res.request.res.responseUrl || url;
        }
        const match = url.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
    } catch { return null; }
}

// Database Schema
const StatusSchema = new mongoose.Schema({ jid: String, active: { type: Boolean, default: true } });
const Status = mongoose.model('Status', StatusSchema);

// Store active users for status broadcasting
let activeUsers = new Set([OWNER_JID]); 

// --- 📝 FUNCTION YA AUTOMATIC DAILY QUOTE STATUS 📝 ---
async function postDailyQuote(sock) {
    try {
        const quotes = [
            "✨ *Venocyber Daily Motivation:*\nMafanikio hayaji kwa kuketi na kusubiri, bali kwa kufanya kazi kwa bidii kila siku. Amka ukapambane leo! 💪🔥",
            "🌟 *Venocyber Daily Motivation:*\nChangamoto za leo ndizo nguvu na busara za kesho. Usikate tamaa, safari yako bado inaendelea! 🚀🌍",
            "🔥 *Venocyber Daily Motivation:*\nHatua ndogo unayopiga leo kwa nidhamu, ndiyo inayokuweka karibu na ndoto zako kubwa za kesho. Siku njema! ✨",
            "💡 *Venocyber Daily Motivation:*\nThe only way to do great work is to love what you do. Kaa ukiamini katika uwezo mkubwa ulio ndani yako leo! 🎯",
            "🌱 *Venocyber Daily Motivation:*\nKila siku mpya ni fursa safi ya kuandika kurasa mpya na nzuri za historia ya maisha yako. Itumie vizuri sana! ❤️",
            "💎 *Venocyber Daily Motivation:*\nHauhitaji kuwa mkamilifu ili kuanza, lakini unahitaji kuanza ili uje kuwa mkamilifu baadae. Anza sasa! ⚡"
        ];
        
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const viewers = Array.from(activeUsers);

        await sock.sendMessage('status@broadcast', { 
            text: randomQuote 
        }, { 
            backgroundColor: '#121214', 
            font: 4, 
            statusJidList: viewers
        });
        console.log("📢 [Auto Status] Nukuu ya leo imepostiwa kiotomatiki safi kabisa!");
    } catch (err) {
        console.log("Auto Status Error:", err.message);
    }
}

async function startVenocyber() {
    await mongoose.connect(MONGO_URL).then(() => console.log("✅ Database Connected")).catch(e => console.log("❌ DB Error"));
    
    const { state, saveCreds } = await useMultiFileAuthState('v_ultra_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"] 
    });

    // Pairing Code logic
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(OWNER_NUMBER);
                console.log(`\n====================================`);
                console.log(`   KODI YAKO YA WHATSAPP: ${code}   `);
                console.log(`====================================\n`);
            } catch (err) { console.log("Inatafuta pairing code..."); }
        }, 10000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const jid = msg.key.remoteJid;

        // --- FEATURE: AUTO STATUS VIEW ---
        if (jid === 'status@broadcast') {
            try {
                await sock.readMessages([msg.key]); 
                const statusSender = msg.key.participant ? msg.key.participant.split('@')[0] : 'Mtu';
                console.log(`👀 [Auto Status View] Umeona status ya: +${statusSender}`);
            } catch (err) { console.log("Status View Error:", err.message); }
            return; 
        }

        if (msg.key.fromMe) return;
        
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        
        // Save user to active list for auto-status visibility
        if (jid && !jid.includes('@g.us')) {
            activeUsers.add(jid);
        }
        
        const mType = Object.keys(msg.message)[0];
        let text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        if (!text) return;

        const args = text.trim().split(/ +/);
        const command = args[0].toLowerCase();
        const mediaUrl = args[1];

        // =========================================================================
        // 🔒 SEHEMU YA KUTAMBUA MMILIKI (OWNER / CREATOR DIRECT TRIGGER)
        // =========================================================================
        const ownerKeywords = /owner|creator|made you|created you|mmiliki|muumbaji|aliyekutengeneza/i;
        if (ownerKeywords.test(text)) {
            const isSwahili = /nani|wako|yako|mwenye|tengeneza|kuunda|aliye/i.test(text);
            if (isSwahili) {
                return await sock.sendMessage(jid, { 
                    text: "Mmiliki wangu ni Venocyber Tech, mbunifu mkubwa wa programu kutoka Tanzania." 
                }, { quoted: msg });
            } else {
                return await sock.sendMessage(jid, { 
                    text: "my owner is Venocyber Tech, a huge programmer in Tanzania." 
                }, { quoted: msg });
            }
        }
        // =========================================================================

        // --- 📥 MULTI-MEDIA DOWNLOADER BLOCK 📥 ---
        const downloadCommands = ['.instagram', '.insta', '.youtube', '.yt', '.tiktok', '.tt', '.x', '.twitter'];
        if (downloadCommands.includes(command)) {
            if (!mediaUrl) return sock.sendMessage(jid, { text: `❌ Weka link. Mfano:\n*${command} https://...*` }, { quoted: msg });
            
            try {
                await sock.sendMessage(jid, { text: "⏳ *Venocyber Ultra Pro:* Inapakua faili lako, subiri kidogo..." }, { quoted: msg });
                
                let videoLink = "";
                let title = "Venocyber Downloader";

                // 1. MPANGO WA YOUTUBE
                if (command === '.youtube' || command === '.yt') {
                    const videoId = getYouTubeId(mediaUrl);
                    if (!videoId) return sock.sendMessage(jid, { text: "❌ Link ya YouTube haijanyooka." }, { quoted: msg });

                    const res = await axios.get(`https://youtube-mp3-audio-video-downloader.p.rapidapi.com/video/${videoId}`, {
                        headers: { 'x-rapidapi-host': 'youtube-mp3-audio-video-downloader.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY }
                    });
                    videoLink = res.data?.video_url || res.data?.link || res.data?.url;
                    title = res.data?.title || "YouTube Video";
                } 
                
                // 2. MPANGO WA TIKTOK
                else if (command === '.tiktok' || command === '.tt') {
                    const videoId = await getTikTokId(mediaUrl);
                    if (!videoId) return sock.sendMessage(jid, { text: "❌ Link ya TikTok haipo sawa." }, { quoted: msg });

                    try {
                        const res = await axios.get(`https://tiktok-scrapper-videos-music-challenges-downloader.p.rapidapi.com/video/${videoId}`, {
                            headers: { 'x-rapidapi-host': 'tiktok-scrapper-videos-music-challenges-downloader.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY }
                        });
                        videoLink = res.data?.video?.download_url || res.data?.data?.play || res.data?.download_url;
                        title = res.data?.video?.description || "TikTok Video";
                    } catch {
                        const fallback = await axios.get(`https://itzpire.site/download/tiktok?url=${encodeURIComponent(mediaUrl)}`);
                        videoLink = fallback.data?.data?.nowm || fallback.data?.data?.watermark;
                    }
                } 
                
                // 3. MPANGO WA INSTAGRAM
                else if (command === '.instagram' || command === '.insta') {
                    try {
                        const res = await axios.get(`https://instagram-downloader-scraper-reels-igtv-posts-stories.p.rapidapi.com/post`, {
                            params: { url: mediaUrl },
                            headers: { 'x-rapidapi-host': 'instagram-downloader-scraper-reels-igtv-posts-stories.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY }
                        });
                        videoLink = res.data?.url || res.data?.data?.video_url || res.data?.download_link || res.data?.media?.[0]?.url;
                    } catch {
                        const fallback = await axios.get(`https://itzpire.site/download/instagram?url=${encodeURIComponent(mediaUrl)}`);
                        videoLink = fallback.data?.data?.[0]?.url || fallback.data?.data?.url;
                    }
                } 
                
                // 4. MPANGO WA TWITTER / X
                else if (command === '.twitter' || command === '.x') {
                    try {
                        const res = await axios.get(`https://twitter-video-downloader5.p.rapidapi.com/download`, {
                            params: { url: mediaUrl },
                            headers: { 'x-rapidapi-host': 'twitter-video-downloader5.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY }
                        });
                        videoLink = res.data?.url || res.data?.result?.url || res.data?.data?.video_url;
                    } catch {
                        const fallback = await axios.get(`https://itzpire.site/download/twitter?url=${encodeURIComponent(mediaUrl)}`);
                        videoLink = fallback.data?.data?.videos?.[0]?.url || fallback.data?.data?.url;
                    }
                    title = "Twitter/X Video";
                }
                
                // KUTUMA VIDEO WHATSAPP
                if (videoLink) {
                    return await sock.sendMessage(jid, { 
                        video: { url: videoLink }, 
                        caption: `🎬 *Venocyber Ultra Pro* 🚀\n\nMzigo uleshuka safi kabisa!` 
                    }, { quoted: msg });
                } else {
                    return sock.sendMessage(jid, { text: "❌ Imeshindikana kupata file la video kwenye link hiyo." }, { quoted: msg });
                }

            } catch (err) {
                console.log("Downloader Error:", err.message);
                return sock.sendMessage(jid, { text: "⚠️ Server ya downloader imetingwa kidogo. Jaribu tena baadae." }, { quoted: msg });
            }
        }

        // --- ⚡ FEATURE: SPEED TRACKER (PING) ⚡ ---
        if (command === '.ping') {
            const timestamp = msg.messageTimestamp;
            const latency = Date.now() - (timestamp * 1000);
            return await sock.sendMessage(jid, { 
                text: `🚀 *Venocyber Ultra Pro Speed:* ${latency < 0 ? 0 : latency} ms` 
            }, { quoted: msg });
        }

        // --- 🎙️ FEATURE: ALIVE VOICE NOTE 🎙️ ---
        if (command === '.alive') {
            try {
                await sock.sendPresenceUpdate('recording', jid);
                const aliveText = "hey Venocyber Ultra Pro is alive welcome";
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(aliveText)}`;
                
                const res = await axios.get(ttsUrl, { responseType: 'arraybuffer' });
                return await sock.sendMessage(jid, { 
                    audio: Buffer.from(res.data, 'binary'), 
                    mimetype: 'audio/mpeg', 
                    ptt: false 
                }, { quoted: msg });
            } catch (err) {
                console.log("Alive Error:", err.message);
                return sock.sendMessage(jid, { text: "🤖 *Venocyber Ultra Pro:* I am alive and welcome!" }, { quoted: msg });
            }
        }

        // --- 📝 FEATURE: MANUAL POST STATUS 📝 ---
        if (command === '.status') {
            if (senderNumber !== OWNER_NUMBER) {
                return sock.sendMessage(jid, { text: "❌ Amri hii ni maalum kwa ajili ya Mmiliki tu!" }, { quoted: msg });
            }

            let statusText = text.slice(command.length).trim();
            if (!statusText) {
                return sock.sendMessage(jid, { text: "❌ Weka maandishi unayotaka yapostiwe kwenye status.\n\nMfano:\n*.status Leo bot ya Venocyber ipo active vizuri sana!* 🔥" }, { quoted: msg });
            }

            try {
                await sock.sendPresenceUpdate('composing', jid);
                const viewers = Array.from(activeUsers);

                await sock.sendMessage('status@broadcast', { 
                    text: statusText 
                }, { 
                    backgroundColor: '#1E1E24', 
                    font: 2, 
                    statusJidList: viewers
                });

                return sock.sendMessage(jid, { text: "✅ *Venocyber Ultra Pro:* Status yako imepostiwa kikamilifu!" }, { quoted: msg });
            } catch (err) {
                console.log("Status Error:", err.message);
                return sock.sendMessage(jid, { text: "⚠️ Imeshindikana kuweka status kwa sasa." }, { quoted: msg });
            }
        }

        // --- 🎙️ FEATURE: TEXT TO SPEECH (TTS) 🎙️ ---
        if (command === '.tts') {
            try {
                await sock.sendPresenceUpdate('recording', jid);
                
                let ttsText = text.slice(command.length).trim();
                
                // SAFARI HII INASOMA REPLIES (QUOTED SMS) KWA USAHIHI
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                const quotedMessage = contextInfo?.quotedMessage;
                
                if (quotedMessage) {
                    ttsText = quotedMessage.conversation || 
                              quotedMessage.extendedTextMessage?.text || 
                              quotedMessage.imageMessage?.caption || 
                              ttsText;
                }
                
                if (!ttsText) {
                    ttsText = "Habari! Mimi ni Venocyber Ultra Pro, bot bora kwa ajili ya kupakua video, na kuangalia status kiotomatiki. Karibu sana!";
                }

                const lang = /[aeiou]ni|[aeiou]na|kwa|mimi|wewe|habari/i.test(ttsText) ? 'sw' : 'en';
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(ttsText.substring(0, 300))}`;
                
                const res = await axios.get(ttsUrl, { responseType: 'arraybuffer' });
                
                return await sock.sendMessage(jid, { 
                    audio: Buffer.from(res.data, 'binary'), 
                    mimetype: 'audio/mpeg', 
                    ptt: false 
                }, { quoted: msg });
                
            } catch (err) {
                console.log("TTS Error:", err.message);
                return sock.sendMessage(jid, { text: "⚠️ Imeshindikana kubadili maandishi kuwa sauti kwa sasa." }, { quoted: msg });
            }
        }
    });

    // --- TIMING AUTOMATION LOGIC ---
    let dailyQuoteTimer;

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            if (dailyQuoteTimer) clearInterval(dailyQuoteTimer); 
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startVenocyber();
        } else if (connection === 'open') {
            console.log('✅ VENOCYBER ULTRA PRO IS ONLINE!');
            
            if (!dailyQuoteTimer) {
                setTimeout(() => postDailyQuote(sock), 30000);
                dailyQuoteTimer = setInterval(() => postDailyQuote(sock), 24 * 60 * 60 * 1000);
            }
        }
    });
}

startVenocyber();

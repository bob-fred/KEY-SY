const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits } = require("discord.js");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// =============================================
//  CONFIGURATION — Remplace ces valeurs !
// =============================================
const BOT_TOKEN = "zio0Tj2chQGbh7hxXE62-BhFk-NPgyDa";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1496207763812909217/GICobiwRXtJs34HQ1-WoQOV9Awst35X3LL6S-z5ztOMwomI6dBFKHPKfKZMQfI_Jlhj9"; // Crée un NOUVEAU webhook (l'ancien est compromis)
// =============================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"],
});

// Stockage temporaire des codes (en mémoire, expire après 10 min)
const codes = new Map(); // discordId -> { code, expiresAt }

client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

client.login(BOT_TOKEN);

// --- ROUTE 1 : Envoyer un code par DM ---
app.post("/send-code", async (req, res) => {
  const { discordId } = req.body;

  if (!discordId || !/^\d{17,20}$/.test(discordId)) {
    return res.status(400).json({ error: "ID Discord invalide." });
  }

  try {
    const user = await client.users.fetch(discordId);
    const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // ex: A3F9C2
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    codes.set(discordId, { code, expiresAt });

    await user.send(
      `🔐 **Ton code de vérification est : \`${code}\`**\nIl expire dans **10 minutes**.\nNe le partage à personne !`
    );

    res.json({ success: true, message: "Code envoyé en DM !" });
  } catch (err) {
    console.error(err);
    if (err.code === 50007) {
      res.status(400).json({ error: "Impossible d'envoyer un DM à cet utilisateur. Vérifie que tes DMs sont ouverts." });
    } else if (err.code === 10013) {
      res.status(400).json({ error: "Cet ID Discord n'existe pas." });
    } else {
      res.status(500).json({ error: "Erreur serveur." });
    }
  }
});

// --- ROUTE 2 : Vérifier le code et envoyer la demande ---
app.post("/verify-and-submit", async (req, res) => {
  const { discordId, code, pseudo } = req.body;

  if (!discordId || !code || !pseudo) {
    return res.status(400).json({ error: "Données manquantes." });
  }

  const entry = codes.get(discordId);

  if (!entry) {
    return res.status(400).json({ error: "Aucun code trouvé pour cet ID. Redemande un code." });
  }

  if (Date.now() > entry.expiresAt) {
    codes.delete(discordId);
    return res.status(400).json({ error: "Code expiré. Redemande un code." });
  }

  if (entry.code !== code.toUpperCase()) {
    return res.status(400).json({ error: "Code incorrect." });
  }

  // Code valide — on envoie au webhook Discord
  codes.delete(discordId); // Code à usage unique

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📋 **Nouvelle demande de pseudo**\n👤 **ID Discord :** \`${discordId}\`\n🏷️ **Pseudo souhaité :** \`${pseudo}\`\n✅ Identité vérifiée`,
      }),
    });

    res.json({ success: true, message: "Demande envoyée avec succès !" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de l'envoi au webhook." });
  }
});

app.listen(3000, () => {
  console.log("🚀 Serveur lancé sur http://localhost:3000");
});

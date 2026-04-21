const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits } = require("discord.js");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN || "LwNuJkM7Ii_nzGobwZnv0CMJ2nWiWLAI";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1496252135581417492/3hAa3JSUYT-A9oDDpLjply3WOA-QzizaXye_xa0fMhOpF2UffYFHShrs-FKuGhInJRYy";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"],
});

const codes = new Map();

client.once("ready", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

client.on("error", (err) => {
  console.error("❌ Erreur bot Discord:", err.message);
});

client.login(BOT_TOKEN).catch((err) => {
  console.error("❌ Impossible de se connecter avec le token:", err.message);
});

app.post("/send-code", async (req, res) => {
  const { discordId } = req.body;

  if (!discordId || !/^\d{17,20}$/.test(discordId)) {
    return res.status(400).json({ error: "ID Discord invalide." });
  }

  try {
    const user = await client.users.fetch(discordId);
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    codes.set(discordId, { code, expiresAt });

    await user.send(
      `🔐 **Ton code de vérification est : \`${code}\`**\nIl expire dans **10 minutes**.\nNe le partage à personne !`
    );

    res.json({ success: true, message: "Code envoyé en DM !" });
  } catch (err) {
    console.error("❌ Erreur send-code:", err.message);
    if (err.code === 50007) {
      res.status(400).json({ error: "Impossible d'envoyer un DM. Vérifie que tes DMs sont ouverts." });
    } else if (err.code === 10013) {
      res.status(400).json({ error: "Cet ID Discord n'existe pas." });
    } else {
      res.status(500).json({ error: "Erreur serveur: " + err.message });
    }
  }
});

app.post("/verify-and-submit", async (req, res) => {
  const { discordId, code, pseudo } = req.body;

  if (!discordId || !code || !pseudo) {
    return res.status(400).json({ error: "Données manquantes." });
  }

  const entry = codes.get(discordId);

  if (!entry) {
    return res.status(400).json({ error: "Aucun code trouvé. Redemande un code." });
  }

  if (Date.now() > entry.expiresAt) {
    codes.delete(discordId);
    return res.status(400).json({ error: "Code expiré. Redemande un code." });
  }

  if (entry.code !== code.toUpperCase()) {
    return res.status(400).json({ error: "Code incorrect." });
  }

  codes.delete(discordId);

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
    console.error("❌ Erreur webhook:", err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi au webhook." });
  }
});

app.listen(3000, () => {
  console.log("🚀 Serveur lancé sur http://localhost:3000");
});

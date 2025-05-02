const express = require("express");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { Configuration, OpenAIApi } = require("openai");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Logging middleware (ekstra debug)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.post("/api/generate-guide", async (req, res) => {
  console.log("➡️ Modtog POST til /api/generate-guide");

  const { destination } = req.body;
  if (!destination) {
    return res.status(400).json({ error: "Destination mangler" });
  }

  async function scrape(url, selector) {
    const html = await (await fetch(url)).text();
    const dom = new JSDOM(html);
    const text = [...dom.window.document.querySelectorAll(selector)]
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .join("\n");
    return text;
  }

  try {
    const [toppenText, enjoyText] = await Promise.all([
      scrape("https://www.toppenafdanmark.dk/skagen", ".teaser__text"),
      scrape("https://www.enjoynordjylland.dk/skagen", "p"),
    ]);

    const combinedText = `Information fra lokale sider:\n\n${toppenText}\n\n${enjoyText}`;

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Du er en lokal rejseekspert, der laver engagerende og nyttige rejseguider.",
        },
        {
          role: "user",
          content: `Lav en rejseguide til ${destination} baseret på dette input:\n\n${combinedText}`,
        },
      ],
    });

    const generatedGuide = completion.data.choices[0].message.content;
    res.json({ guide: generatedGuide });
  } catch (error) {
    console.error("💥 Fejl i /generate-guide:", error);
    res.status(500).json({ error: "Noget gik galt med genereringen." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server kører på port ${PORT}`));

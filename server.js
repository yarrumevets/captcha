import express from "express";
import { fileURLToPath } from "url";
import gm from "gm";
const SERVER_PORT = 4191;
const app = express();
const TIMEOUT_SECONDS = 30;

// @TODO - Handle the issue where if you ping the server without the old captchaID
// it will keep adding to the cache. Perhaps pass in some identifier to distinguish users.

const idCache = {};
const timeouts = {};

// Public.
app.use(express.json());
app.use("/", express.static(fileURLToPath(new URL("public", import.meta.url))));

const generateRandomText = (length) => {
  return Math.random()
    .toString(36)
    .substring(2, length + 2)
    .toUpperCase();
};

const generateCaptchaId = (text) => {
  const id = Math.random().toString(36).substring(2, 10);
  idCache[id] = text;
  timeouts[id] = setTimeout(() => {
    delete idCache[id];
  }, TIMEOUT_SECONDS * 1000);
  return id;
};

const generateCaptchaImage = (text, callback) => {
  return new Promise((resolve, reject) => {
    gm(200, 80, "#EEE") // Background color
      .fill("#000")
      .font("Arial", 40)
      .drawText(30, 50, text)
      .draw("line 10,10 190,70")
      .draw("line 20,60 180,20")
      .noise(3)
      .toBuffer("PNG", (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
  });
};

// Generate hash for user guess
const checkGuess = (guess, captchaId) => {
  return idCache[captchaId] && idCache[captchaId] === guess.toUpperCase();
};

const handleCaptchaRequest = async (req, res) => {
  try {
    const text = generateRandomText(4);
    const captchaId = generateCaptchaId(text);
    const buffer = await generateCaptchaImage(text);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-Captcha-Id", captchaId);
    res.send(buffer);
  } catch (err) {
    res.status(500).send("Error generating CAPTCHA");
  }
};

app.get("/api/image", async (req, res) => {
  const captchaId = req.query.captchaId;
  if (idCache[captchaId] && timeouts[captchaId]) {
    // These discard the current captcha and timout.
    clearTimeout(timeouts[captchaId]);
    delete idCache[captchaId];
  }
  handleCaptchaRequest(req, res);
});

app.post("/api/guess", (req, res) => {
  const guess = req.body.guess;
  const captchaId = req.body.captchaId;
  const isCorrect = checkGuess(guess, captchaId);
  res.status(200).json({ isCorrect });
});

// Run the server
app.listen(SERVER_PORT, () => {
  console.log(`Server running on port ${SERVER_PORT}`);
});

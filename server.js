import express from "express";
import { fileURLToPath } from "url";
import gm from "gm";
import config from "./config.js";

const app = express();

// @TODO
// - Handle the issue where if you ping the server without the old captchaID
//    it will keep adding to the cache. Perhaps pass in some identifier to distinguish users.
// - Pre-create a list of images/ids to some maximum,
//    like a token bucket used for rate limiting, to better handle bursts.
// - Delay the removal of old IDs by a couple seconds so users can still enter the value when it suddenly updates the image.

const idCache = {};
const timeouts = {};

// Public.
app.use(express.json());
app.use("/", express.static(fileURLToPath(new URL("public", import.meta.url))));

const generateRandomText = (length) => {
  console.log("type of length: ", typeof length);
  return Math.random()
    .toString(36)
    .substring(2, length + 2)
    .toUpperCase();
};

const generateCaptchaId = (text, timeout) => {
  const id = Math.random().toString(36).substring(2, 10);
  idCache[id] = text;
  timeouts[id] = setTimeout(() => {
    delete idCache[id];
  }, timeout);
  return id;
};

const generateCaptchaImage = (text, noise, backgroundColor, textColor) => {
  return new Promise((resolve, reject) => {
    gm(200, 80, `#${backgroundColor}`) // Background color
      .fill(`#${textColor}`)
      .font("Arial", 40)
      .drawText(30, 50, text)
      .draw("line 10,10 190,70")
      .draw("line 20,60 180,20")
      .noise(noise)
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
  console.log("req.params: ", req.query);

  const textLength = req.query.textLength
    ? Number(req.query.textLength)
    : config.TEXT_LENGTH;
  const noise = req.query.noise || config.NOISE;
  const timeout = req.query.timeout || config.TIMEOUT;
  const backgroundColor = req.query.backgroundColor || config.BACKGROUND_COLOR;
  const textColor = req.query.textColor || config.TEXT_COLOR;

  try {
    const text = generateRandomText(textLength);
    const captchaId = generateCaptchaId(text, timeout);
    const buffer = await generateCaptchaImage(
      text,
      noise,
      backgroundColor,
      textColor
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-Captcha-Id", captchaId);
    res.send(buffer);
  } catch (err) {
    console.error("Error generating CAPTCHA: ", err);
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
app.listen(config.SERVER_PORT, () => {
  console.log(`Server running on port ${config.SERVER_PORT}`);
});

const submitButton = document.getElementById("submit-button");
const refreshButton = document.getElementById("refresh-button");
const userInput = document.getElementById("user-input");
const captchaImage = document.getElementById("captcha-image");

let captchaId = "";
const IMAGE_INTERVAL = 8_000;

submitButton.addEventListener("click", () => {
  fetch("/api/guess", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guess: userInput.value, captchaId }),
  })
    .then((response) => response.text())
    .then((responseText) => {
      console.log("response text: ", responseText);
    })
    .catch((error) => {
      console.error("Error fetching captcha image", error);
    });
});

const getImage = (previousId) => {
  const backgroundColor = "CCF";
  const textColor = "F04";
  const timeout = IMAGE_INTERVAL;
  const noise = 3.8;
  const textLength = 3; // 4 to 8
  let url = `/api/image?backgroundColor=${backgroundColor}&textColor=${textColor}&timeout=${timeout}&noise=${noise}&textLength=${textLength}`;

  if (previousId) {
    // Pass current ID so it can be removed on the server.
    url += `&captchaId=${previousId}`;
  }

  fetch(url)
    .then((response) => {
      captchaId = response.headers.get("X-Captcha-Id");
      return response.blob().then((blob) => {
        return { blob, captchaId };
      });
    })
    .then(({ blob, captchaId }) => {
      const imageUrl = URL.createObjectURL(blob);
      captchaImage.src = imageUrl;
      captchaImage.title = captchaId; // @TODO find a better place for the ID.
    })
    .catch((error) => {
      console.error("Error fetching captcha image:", error);
    });
};

getImage();

// Pass in the current ID so it gets cleared on the server.
let theInterval = setInterval(() => {
  getImage(captchaId);
}, IMAGE_INTERVAL);

refreshButton.addEventListener("click", () => {
  clearInterval(theInterval);
  getImage(captchaId);
  theInterval = setInterval(() => {
    getImage(captchaId);
  }, IMAGE_INTERVAL);
});

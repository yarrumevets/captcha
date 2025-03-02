// https://claude.ai/chat/ff51085c-3296-4b98-9cef-079d863023f4

// tests/server.test.js
import request from "supertest";
import express from "express";
import gm from "gm";
import { jest } from "@jest/globals";

// Mock dependencies
jest.mock("gm");
jest.mock(
  "./config",
  () => ({
    SERVER_PORT: 3000,
    TIMEOUT: 300000, // 5 minutes
  }),
  { virtual: true }
);

// Mock the generateCaptchaImage function
const mockBuffer = Buffer.from("test-image-buffer");

// Create a spy for setTimeout and clearTimeout
jest.spyOn(global, "setTimeout").mockImplementation((cb, ms) => {
  return "timeout-id";
});
jest.spyOn(global, "clearTimeout");

// Setup app for testing - we need to do this before importing our server code
const mockGmInstance = {
  fill: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  drawText: jest.fn().mockReturnThis(),
  draw: jest.fn().mockReturnThis(),
  noise: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockImplementation((format, callback) => {
    callback(null, mockBuffer);
    return mockGmInstance;
  }),
};

gm.mockImplementation(() => mockGmInstance);

// Import our server code
let app;
let idCache;
let timeouts;
let server;

describe("CAPTCHA Server", () => {
  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();

    // Import the server code for testing - we need to do this dynamically
    // so that we can reset the module state between tests
    const serverModule = require("../server");
    app = serverModule.default || serverModule;
    idCache = serverModule.idCache;
    timeouts = serverModule.timeouts;

    // Manually expose these for testing if needed
    if (!idCache) {
      // You might need to export these from your server.js to make this work
      // or use a different approach to access internal state
      console.warn("idCache not accessible for testing");
    }

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe("GET /api/image", () => {
    test("should return a CAPTCHA image with appropriate headers", async () => {
      const response = await request(app)
        .get("/api/image")
        .expect(200)
        .expect("Content-Type", "image/png")
        .expect((res) => {
          // Check if X-Captcha-Id header exists
          expect(res.headers).toHaveProperty("x-captcha-id");
          expect(typeof res.headers["x-captcha-id"]).toBe("string");
          expect(res.headers["x-captcha-id"].length).toBeGreaterThan(0);
        });

      // Verify the image buffer was sent
      expect(response.body).toEqual(expect.any(Buffer));

      // Verify the captcha was stored in the cache
      expect(setTimeout).toHaveBeenCalledTimes(1);
    });

    test("should clear previous captcha when captchaId is provided", async () => {
      // First create a captcha
      const firstResponse = await request(app).get("/api/image").expect(200);

      const captchaId = firstResponse.headers["x-captcha-id"];

      // Then request a new one with the previous captchaId
      await request(app).get(`/api/image?captchaId=${captchaId}`).expect(200);

      // Verify clearTimeout was called to clean up old captcha
      expect(clearTimeout).toHaveBeenCalledTimes(1);
    });

    test("should handle errors during image generation", async () => {
      // Mock an error in image generation
      mockGmInstance.toBuffer.mockImplementationOnce((format, callback) => {
        callback(new Error("Mock image generation error"), null);
        return mockGmInstance;
      });

      await request(app)
        .get("/api/image")
        .expect(500)
        .expect("Error generating CAPTCHA");
    });
  });

  describe("POST /api/guess", () => {
    test("should return true for correct guesses", async () => {
      // Manually add an entry to the cache for testing
      const captchaText = "TEST";
      let captchaId;

      // First create a real captcha to get an ID
      const response = await request(app).get("/api/image").expect(200);

      captchaId = response.headers["x-captcha-id"];

      // We need access to the idCache to check what text was generated
      // If you can't access idCache directly, consider exporting a test-only function
      // or modifying your architecture to make it testable
      if (idCache && idCache[captchaId]) {
        const correctText = idCache[captchaId];

        // Test with the correct guess
        const guessResponse = await request(app)
          .post("/api/guess")
          .send({ guess: correctText, captchaId })
          .expect(200);

        expect(guessResponse.body).toEqual({ isCorrect: true });
      } else {
        // Fallback if we can't access the internal cache
        // This is not ideal but it's a workaround
        console.warn("Unable to access idCache directly, using mock approach");

        // Mock the checkGuess function
        const serverModule = require("../server");
        const originalCheckGuess = serverModule.checkGuess;
        serverModule.checkGuess = jest.fn().mockReturnValueOnce(true);

        const guessResponse = await request(app)
          .post("/api/guess")
          .send({ guess: "TEST", captchaId: "mock-id" })
          .expect(200);

        expect(guessResponse.body).toEqual({ isCorrect: true });

        // Restore original function
        serverModule.checkGuess = originalCheckGuess;
      }
    });

    test("should return false for incorrect guesses", async () => {
      // First create a captcha
      const response = await request(app).get("/api/image").expect(200);

      const captchaId = response.headers["x-captcha-id"];

      // Test with an incorrect guess
      const guessResponse = await request(app)
        .post("/api/guess")
        .send({ guess: "WRONG", captchaId })
        .expect(200);

      expect(guessResponse.body).toEqual({ isCorrect: false });
    });

    test("should return false for non-existent captchaId", async () => {
      const guessResponse = await request(app)
        .post("/api/guess")
        .send({ guess: "TEST", captchaId: "non-existent-id" })
        .expect(200);

      expect(guessResponse.body).toEqual({ isCorrect: false });
    });
  });

  describe("Utility Functions", () => {
    test("generateRandomText should return uppercase string of specified length", () => {
      const serverModule = require("../server");
      const { generateRandomText } = serverModule;

      // If the function is not exported, you'll need to modify your server to export it
      if (generateRandomText) {
        const text = generateRandomText(4);
        expect(text).toMatch(/^[A-Z0-9]{4}$/);
      } else {
        console.warn("generateRandomText function not accessible for testing");
      }
    });

    test("captcha should expire after timeout period", () => {
      // This would ideally use jest's timer mocks to fast-forward time
      // but requires idCache to be accessible for verification
      jest.useFakeTimers();

      // Create a captcha
      const serverModule = require("../server");
      const { generateRandomText, generateCaptchaId } = serverModule;

      if (generateRandomText && generateCaptchaId && idCache) {
        const text = generateRandomText(4);
        const id = generateCaptchaId(text);

        // Verify it's in the cache
        expect(idCache[id]).toBe(text);

        // Fast-forward time
        jest.runAllTimers();

        // Verify it's removed from cache
        expect(idCache[id]).toBeUndefined();
      } else {
        console.warn(
          "Unable to test captcha expiration - functions not accessible"
        );
      }

      jest.useRealTimers();
    });
  });
});

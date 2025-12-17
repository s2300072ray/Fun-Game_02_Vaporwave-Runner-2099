# Neon Runner 2099

A high-octane, cyberpunk-themed 3D endless runner built with React Three Fiber and Google Gemini API.

## 🛡️ Security & API Key Setup

This project uses the Google Gemini API for generating dynamic game commentary. To ensure security:

1.  **Never commit your API Key to GitHub.**
2.  This project includes a `.gitignore` file that excludes `.env` files.
3.  Create a file named `.env` in the root directory (if running locally) with the following content:

```env
API_KEY=your_actual_api_key_here
```

### For Public Deployment (Publishing)

Since this is a frontend-only application, your API Key will be visible in the browser's network requests. To prevent unauthorized usage:

1.  Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2.  Select your API Key.
3.  Under **Application restrictions**, select **Websites**.
4.  Add your published website's URL (e.g., `https://your-app-name.w3spaces.com/*`).

## 🎮 Controls

*   **A / Left Arrow**: Move Left
*   **D / Right Arrow**: Move Right
*   **Space / Up Arrow**: Jump

## 🤖 AI Features

The game uses `gemini-2.5-flash` to analyze your run (Score + Duration) and generate a cynical, cyberpunk-style commentary on the Game Over screen.

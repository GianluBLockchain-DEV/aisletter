import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Store previously generated templates for faster response
const templateCache = new Map();

// Improved console logging
function logInfo(message) {
  console.log(`[INFO ${new Date().toISOString()}] ${message}`);
}

function logError(message, error) {
  console.error(`[ERROR ${new Date().toISOString()}] ${message}`, error);
}

// Enhanced prompt for better design focus
app.post("/generate", async (req, res) => {
  try {
    const {
      tone,
      businessType,
      targetAudience,
      purpose,
      keyFeatures,
      pages,
      colorScheme, // New parameter
      layoutStyle, // New parameter
      includeImages, // New parameter
      includeSocial, // New parameter
    } = req.body;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      logError("Missing OpenAI API Key");
      return res.status(500).json({ error: "Missing OpenAI API Key" });
    }

    // Create cache key from parameters
    const cacheKey = JSON.stringify(req.body);

    // Check if we have a cached version
    if (templateCache.has(cacheKey)) {
      logInfo(`Returning cached template for ${businessType}`);
      return res.json({ html: templateCache.get(cacheKey) });
    }

    const prompt = `
Act as an expert in newsletter design and marketing. Create a highly engaging, structured HTML newsletter template with CSS in the head, tailored to the specified parameters. Focus primarily on design aesthetics, not content.

**Important Design Guidelines:**
- Use Lorem Ipsum for ALL text content
- Create visually appealing layouts with proper spacing and balance
- Focus on professional design principles and visual hierarchy
- Ensure the design matches the specified tone and business type
- Include placeholder images with appropriate dimensions and positioning

## Parameters:
- Tone: ${tone.join(", ")}
- Business Type: ${businessType}
- Target Audience: ${targetAudience}
- Purpose: ${purpose}
- Key Features: ${keyFeatures.join(", ")}
- Number of Pages: ${pages}
- Color Scheme: ${colorScheme || "Professional"}
- Layout Style: ${layoutStyle || "Standard"}
- Include Image Placeholders: ${includeImages ? "Yes" : "No"}
- Include Social Media Icons: ${includeSocial ? "Yes" : "No"}

## Design Requirements:
- Output valid HTML code with CSS in the <head>
- All key inputs should influence the layout, colors, and design
- Use a color palette of 3-5 colors that complement each other and match the tone
- Create responsive layouts that work on mobile and desktop devices
- Include proper spacing between elements for visual breathing room
- For images, use placeholder divs with background colors and dimensions
- Include well-designed call-to-action buttons with hover effects
- If social media is included, add properly styled social media icons in the footer
- Design header and footer that match the overall aesthetic
- Add subtle design accents (dividers, borders, background patterns) that enhance the design
- Ensure all fonts are web-safe or include Google Fonts links
- Return only the final HTML and CSS code

The template should demonstrate excellent visual design principles while using Lorem Ipsum for all content.
`;

    logInfo(
      `Generating newsletter template for ${businessType} with ${tone.join(
        ", "
      )} tone`
    );

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.9, // Slightly higher for more creative designs
          }),
        }
      );

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response structure from OpenAI API");
      }

      const generatedHTML = data.choices[0].message.content;

      // Cache the result
      templateCache.set(cacheKey, generatedHTML);

      // Clean up cache if it gets too large (keep only the most recent 50 templates)
      if (templateCache.size > 50) {
        const keys = Array.from(templateCache.keys());
        templateCache.delete(keys[0]);
      }

      logInfo(
        `Successfully generated newsletter template (${generatedHTML.length} bytes)`
      );
      res.json({ html: generatedHTML });
    } catch (err) {
      logError("OpenAI API request failed", err);
      res
        .status(500)
        .json({ error: "Failed to generate newsletter", details: err.message });
    }
  } catch (err) {
    logError("Unexpected error in /generate endpoint", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// New endpoint to get design presets
app.get("/presets", (req, res) => {
  try {
    const presets = {
      colorSchemes: [
        {
          name: "Professional",
          colors: ["#003366", "#FFFFFF", "#CCCCCC", "#336699"],
        },
        {
          name: "Vibrant",
          colors: ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF"],
        },
        {
          name: "Minimal",
          colors: ["#F8F9FA", "#212529", "#ADB5BD", "#DEE2E6"],
        },
        {
          name: "Elegant",
          colors: ["#2C3639", "#DCD7C9", "#A27B5C", "#3F4E4F"],
        },
        {
          name: "Playful",
          colors: ["#FFBE0B", "#FB5607", "#FF006E", "#8338EC", "#3A86FF"],
        },
      ],
      layoutStyles: [
        "Standard",
        "Modern Grid",
        "Single Column",
        "Magazine",
        "Corporate",
      ],
    };

    logInfo("Presets fetched successfully");
    res.json(presets);
  } catch (err) {
    logError("Error fetching presets", err);
    res.status(500).json({ error: "Failed to fetch design presets" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logError("Global error handler caught:", err);
  res.status(500).json({ error: "Something went wrong", details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logInfo(`Server running on http://localhost:${PORT}`));

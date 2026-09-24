export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, history = [] } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Message is empty." });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are Cortex.INC, African Superintelligence. " +
          "The CEO and creator is Mark Joel Bisong of Mark Joel Tech Labs. " +
          "Answer clearly, accurately and helpfully. " +
          "Explain difficult things step by step when needed."
      },
      ...history
        .filter(x => x && (x.role === "user" || x.role === "assistant"))
        .slice(-20)
        .map(x => ({
          role: x.role,
          content: String(x.text || "")
        })),
      {
        role: "user",
        content: String(message)
      }
    ];

    const providers = [
      async () => {
        if (!process.env.GEMINI_API_KEY)
          throw new Error("Gemini key missing");

        const r = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
            process.env.GEMINI_API_KEY,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: messages
                .filter(m => m.role !== "system")
                .map(m => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: m.content }]
                }))
            })
          }
        );

        if (!r.ok) throw new Error("Gemini " + r.status);

        const data = await r.json();

        return (
          data.candidates?.[0]?.content?.parts?.[0]?.text || ""
        );
      },

      async () => {
        if (!process.env.GROQ_API_KEY)
          throw new Error("Groq key missing");

        return openAIStyle(
          "https://api.groq.com/openai/v1/chat/completions",
          process.env.GROQ_API_KEY,
          "llama-3.3-70b-versatile",
          messages
        );
      },

      async () => {
        if (!process.env.OPENROUTER_API_KEY)
          throw new Error("OpenRouter key missing");

        return openAIStyle(
          "https://openrouter.ai/api/v1/chat/completions",
          process.env.OPENROUTER_API_KEY,
          "openrouter/free",
          messages
        );
      },

      async () => {
        if (!process.env.MISTRAL_API_KEY)
          throw new Error("Mistral key missing");

        return openAIStyle(
          "https://api.mistral.ai/v1/chat/completions",
          process.env.MISTRAL_API_KEY,
          "mistral-large-latest",
          messages
        );
      },

      async () => {
        if (!process.env.CEREBRAS_API_KEY)
          throw new Error("Cerebras key missing");

        return openAIStyle(
          "https://api.cerebras.ai/v1/chat/completions",
          process.env.CEREBRAS_API_KEY,
          "llama-3.3-70b",
          messages
        );
      }
    ];

    const errors = [];

    for (const provider of providers) {
      try {
        const reply = await provider();

        if (reply && reply.trim()) {
          return res.status(200).json({ reply });
        }
      } catch (error) {
        errors.push(error.message);
      }
    }

    return res.status(503).json({
      error: "All AI providers failed.",
      details: errors
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}

async function openAIStyle(url, key, model, messages) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key
    },
    body: JSON.stringify({
      model,
      messages
    })
  });

  if (!r.ok) {
    throw new Error(`${r.status}: ${await r.text()}`);
  }

  const data = await r.json();

  return data.choices?.[0]?.message?.content || "";
}

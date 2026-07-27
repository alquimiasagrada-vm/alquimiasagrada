export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Asegurar que se lea el body correctamente independientemente de cómo lo envíe el cliente
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const message = body?.message;

    if (!message) {
      return res.status(400).json({ error: 'Falta el mensaje en la petición' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'La variable GEMINI_API_KEY no está configurada en Vercel' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          systemInstruction: {
            parts: [{ text: "Eres un oráculo sabio, místico y empático..." }]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al comunicarse con la API de Gemini');
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'El oráculo guarda silencio por ahora...';

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

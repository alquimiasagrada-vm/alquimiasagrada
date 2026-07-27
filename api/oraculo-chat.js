export default async function handler(req, res) {
  // Permitir solo peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Manejo seguro del body para asegurarnos de que no llegue vacío
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    const message = body?.message;

    if (!message) {
      return res.status(400).json({ error: 'El campo "message" es obligatorio en el JSON' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta configurar la variable GEMINI_API_KEY en Vercel' });
    }

    // Petición directa y limpia a la API oficial de Google
    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
          systemInstruction: {
            parts: [{ text: "Eres un oráculo sabio, místico y empático." }]
          }
        })
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(500).json({ error: data.error?.message || 'Error al conectar con la API de Google' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'El oráculo guarda silencio por ahora...';

    return res.status(200).json({ reply });
    
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor: ' + err.message });
  }
}

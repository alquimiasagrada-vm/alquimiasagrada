export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { datosCarta } = req.body;

  if (!datosCarta) {
    return res.status(400).json({ error: 'Faltan los datos de la carta natal' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptTexto = `Actúa como un astrólogo profesional, empático y místico para la marca "Alquimia Sagrada". Interpreta de forma breve, inspiradora y profunda los siguientes datos de una carta natal: ${JSON.stringify(datosCarta)}. Dale un formato estético y cálido en español.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptTexto }]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    // Extraer la respuesta generada por Gemini
    const textoInterpretacion = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ interpretacion: textoInterpretacion });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno al procesar la interpretación.' });
  }
}

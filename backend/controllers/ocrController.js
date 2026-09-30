const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.processReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);

    // Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: imageBuffer.toString('base64'),
          },
        },
        'Analyze this receipt. Extract the total amount, merchant name, and date. Also categorize it into one of these: Food, Shopping, Transport, Bills, Entertainment, Others. Return the response as a JSON object with keys: amount, merchant, date (YYYY-MM-DD), category, notes.',
      ],
    });

    const text = response.text;
    
    // Parse JSON from text
    let data;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      data = JSON.parse(jsonStr);
    } catch (e) {
      // Fallback if parsing fails
      data = {
        amount: 0,
        merchant: 'Unknown',
        date: new Date().toISOString().slice(0, 10),
        category: 'Others',
        notes: text,
      };
    }

    // Delete the file after processing
    fs.unlinkSync(imagePath);

    res.status(200).json(data);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
};
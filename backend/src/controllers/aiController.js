const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');

const logError = (name, error) => {
  try {
    const msg = `[${new Date().toISOString()}] ${name}: ${error.stack || error.message || error}\n`;
    fs.appendFileSync(path.join(__dirname, '../../teacher_error.log'), msg);
    console.error(name, error);
  } catch(e) {}
};

let genAI;

/**
 * @desc    AI Tutor: Teach Me a Topic
 * @route   POST /api/ai-tutor/teach
 * @access  Private (Student/Teacher/Admin)
 */
const teachMe = async (req, res) => {
  try {
    const { topic, question } = req.body;
    const finalTopic = (topic || question || '').trim();

    if (!finalTopic) {
      return res.status(400).json({ error: 'Please provide a topic or a question.' });
    }

    const apiKey = process.env.GOOGLE_AI_KEY?.trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'AI Tutor is not configured (missing API Key on server).' });
    }

    // Lazy init
    if (!genAI) {
      genAI = new GoogleGenerativeAI(apiKey);
    }

    // Model configurations
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const prompt = `
      You are an expert AI Tutor. Topic: "${finalTopic}".
      Please provide:
      1. Explanation
      2. Study Notes
      3. Practical Tip
      Format your response exactly like this:
      ---EXPLANATION_START---
      [Detailed explanation]
      ---EXPLANATION_END---
      ---NOTES_START---
      [Summarized bullet points]
      ---NOTES_END---
      ---TIP_START---
      [Short practical tip]
      ---TIP_END---
    `;

    let result;
    try {
      const flashModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', safetySettings });
      result = await flashModel.generateContent(prompt);
    } catch (error) {
      console.warn('Primary AI model failed, trying fallback...');
      const proModel = genAI.getGenerativeModel({ model: 'gemini-pro', safetySettings });
      result = await proModel.generateContent(prompt);
    }

    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('AI returned an empty response.');
    }

    // Parsing
    const explanation = text.match(/---EXPLANATION_START---([\s\S]*?)---EXPLANATION_END---/)?.[1]?.trim() || 
                       text.split('---NOTES_START---')[0].replace('---EXPLANATION_START---', '').trim();
    const studyNotes = text.match(/---NOTES_START---([\s\S]*?)---NOTES_END---/)?.[1]?.trim() || 'Notes summary not available.';
    const practicalTip = text.match(/---TIP_START---([\s\S]*?)---TIP_END---/)?.[1]?.trim() || '';

    res.json({
      explanation: explanation || 'Please see raw response below.',
      studyNotes,
      practicalTip,
      raw: text
    });

  } catch (error) {
    logError('AI Tutor Error', error);
    res.status(500).json({ 
      error: 'Failed to generate explanation. Please check your API key and quota.' 
    });
  }
};

/**
 * @desc    Save AI Notes to Personal Notebook
 * @route   POST /api/ai-tutor/save
 * @access  Private
 */
const saveAINotes = async (req, res) => {
  try {
    const { title, content, category = 'Study' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const note = await prisma.note.create({
      data: {
        userId: req.user.id,
        title,
        content,
        category
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Save AI Notes Error:', error);
    res.status(500).json({ error: 'Failed to save notes.' });
  }
};

module.exports = {
  teachMe,
  saveAINotes
};

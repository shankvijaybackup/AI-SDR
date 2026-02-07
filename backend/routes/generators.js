import express from 'express';
import { ContentGeneratorService } from '../services/contentGenerator.js';

const router = express.Router();

// Analyze Message
router.post('/message-analysis', async (req, res) => {
    try {
        const { message, persona } = req.body;
        const result = await ContentGeneratorService.analyzeMessage(message, persona);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate Headline
router.post('/headline', async (req, res) => {
    try {
        const { role, industry, tone } = req.body;
        const result = await ContentGeneratorService.generateHeadline(role, industry, tone);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sales Nav Filters
router.post('/filters', async (req, res) => {
    try {
        const { query } = req.body;
        const result = await ContentGeneratorService.generateSalesNavFilters(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Icebreaker
router.post('/icebreaker', async (req, res) => {
    try {
        const { profileUrl, context } = req.body;
        const result = await ContentGeneratorService.generateIcebreaker(profileUrl, context);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

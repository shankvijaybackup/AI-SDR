import express from 'express';
import { SignalDetectionService } from '../services/signalDetection.js';

const router = express.Router();

// Trigger detection for an account
router.post('/detect/account/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const signals = await SignalDetectionService.detectForAccount(accountId);
        res.json({ success: true, count: signals.length, signals });
    } catch (error) {
        console.error("Signal detection failed:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

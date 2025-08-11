import express from 'express';
import { liveScoringService } from '../services/liveScoring';

const router = express.Router();

/**
 * Production Scoring Routes
 * These handle live scoring for the 2025 NFL season
 */

// Get live scoring status
router.get('/live-status', async (req, res) => {
  try {
    const status = await liveScoringService.getLiveGamesStatus();
    res.json({
      ...status,
      message: 'Live scoring service operational',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting live scoring status:', error);
    res.status(500).json({ error: 'Failed to get live scoring status' });
  }
});

// Start live scoring updates (admin only)
router.post('/start-live-updates', async (req, res) => {
  try {
    liveScoringService.startLiveUpdates();
    res.json({
      success: true,
      message: 'Live scoring updates started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting live updates:', error);
    res.status(500).json({ error: 'Failed to start live updates' });
  }
});

// Stop live scoring updates (admin only)
router.post('/stop-live-updates', async (req, res) => {
  try {
    liveScoringService.stopLiveUpdates();
    res.json({
      success: true,
      message: 'Live scoring updates stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error stopping live updates:', error);
    res.status(500).json({ error: 'Failed to stop live updates' });
  }
});

export { router as productionScoringRouter };
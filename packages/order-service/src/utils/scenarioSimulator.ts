import { Request, Response, NextFunction } from 'express';

export type ScenarioType = 'error' | 'internal-error' | 'long-latency' | 'random-latency' | 'timeout' | 'normal';

/**
 * Simulates different application scenarios based on query parameters
 * Usage: Add ?scenario=error or ?scenario=long-latency to any endpoint
 */
export const scenarioSimulator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const scenario = req.query.scenario as ScenarioType;

  try {
    switch (scenario) {
      case 'error':
        // Simulate a 400 Bad Request error
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Simulated client error',
          timestamp: new Date().toISOString()
        });

      case 'internal-error':
        // Simulate a 500 Internal Server Error
        throw new Error('Simulated internal server error');

      case 'long-latency':
        // Simulate 5 second delay
        await delay(5000);
        break;

      case 'random-latency':
        // Random delay between 100ms and 3000ms
        const randomDelay = Math.floor(Math.random() * 2900) + 100;
        await delay(randomDelay);
        break;

      case 'timeout':
        // Simulate a very long operation (30 seconds)
        await delay(30000);
        break;

      case 'normal':
      default:
        // No delay, proceed normally
        break;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to create a delay
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Middleware to add scenario information to response headers
 */
export const addScenarioHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const scenario = req.query.scenario || 'normal';
  res.setHeader('X-Scenario', scenario as string);
  next();
};

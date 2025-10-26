import { Request, Response, NextFunction } from 'express';
import { scenarioSimulator, addScenarioHeaders } from '../../src/utils/scenarioSimulator';

describe('Scenario Simulator Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      query: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    nextFunction = jest.fn();
  });

  describe('error scenario', () => {
    it('should return 400 Bad Request', async () => {
      mockRequest.query = { scenario: 'error' };

      await scenarioSimulator(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          message: 'Simulated client error',
          timestamp: expect.any(String),
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('internal-error scenario', () => {
    it('should throw an error', async () => {
      mockRequest.query = { scenario: 'internal-error' };

      await scenarioSimulator(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Simulated internal server error',
        })
      );
    });
  });

  describe('long-latency scenario', () => {
    it('should introduce a delay of ~5 seconds', async () => {
      mockRequest.query = { scenario: 'long-latency' };

      const startTime = Date.now();
      await scenarioSimulator(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(4900); // Allow some tolerance
      expect(duration).toBeLessThan(5500);
      expect(nextFunction).toHaveBeenCalled();
    }, 10000); // Increase timeout for this test
  });

  describe('random-latency scenario', () => {
    it('should introduce a random delay between 100ms and 3000ms', async () => {
      mockRequest.query = { scenario: 'random-latency' };

      const startTime = Date.now();
      await scenarioSimulator(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(50); // Allow some tolerance
      expect(duration).toBeLessThan(3500);
      expect(nextFunction).toHaveBeenCalled();
    }, 5000);
  });

  describe('normal scenario', () => {
    it('should proceed without delay', async () => {
      mockRequest.query = { scenario: 'normal' };

      const startTime = Date.now();
      await scenarioSimulator(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should be almost instant
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('no scenario', () => {
    it('should proceed without delay when no scenario is specified', async () => {
      mockRequest.query = {};

      const startTime = Date.now();
      await scenarioSimulator(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});

describe('Add Scenario Headers Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    setHeaderMock = jest.fn();

    mockRequest = {
      query: {},
    };

    mockResponse = {
      setHeader: setHeaderMock,
    };

    nextFunction = jest.fn();
  });

  it('should add X-Scenario header with scenario value', () => {
    mockRequest.query = { scenario: 'error' };

    addScenarioHeaders(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(setHeaderMock).toHaveBeenCalledWith('X-Scenario', 'error');
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should add X-Scenario header with "normal" when no scenario is specified', () => {
    mockRequest.query = {};

    addScenarioHeaders(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(setHeaderMock).toHaveBeenCalledWith('X-Scenario', 'normal');
    expect(nextFunction).toHaveBeenCalled();
  });
});

let paddleServerInstance: any = null;

export async function getPaddleInstance(): Promise<any> {
  if (paddleServerInstance) {
    return paddleServerInstance;
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error('PADDLE_API_KEY environment variable is required to interact with Paddle server API');
  }

  const isProduction = process.env.NEXT_PUBLIC_PADDLE_ENV?.toLowerCase() === 'production';

  try {
    const { Paddle, Environment, LogLevel } = await import('@paddle/paddle-node-sdk');
    paddleServerInstance = new Paddle(apiKey, {
      environment: isProduction ? Environment.production : Environment.sandbox,
      logLevel: isProduction ? LogLevel.error : LogLevel.verbose,
    });
    return paddleServerInstance;
  } catch (err: any) {
    console.error('Failed to instantiate Paddle Node SDK:', err);
    throw new Error(`Paddle SDK initialization failure: ${err.message}`);
  }
}

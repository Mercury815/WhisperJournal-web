/**
 * 本機開發：自動啟動 redis-memory-server（Windows 會拉 Memurai），無需 Docker。
 * 若已自行啟動 Redis，請改用 npm run start:dev:live-redis
 */
const { spawn } = require('child_process');
const path = require('path');

async function main() {
  const RedisMemoryServer = require('redis-memory-server').default;

  let redisServer;
  let child;

  const stopAll = async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
    if (redisServer) {
      await redisServer.stop().catch(() => undefined);
    }
  };

  process.on('SIGINT', () => void stopAll().finally(() => process.exit(0)));
  process.on('SIGTERM', () => void stopAll().finally(() => process.exit(0)));

  redisServer = await RedisMemoryServer.create({});
  await redisServer.start();
  const host = await redisServer.getHost();
  const port = await redisServer.getPort();
  console.error(`[dev] Embedded Redis at ${host}:${port} (set REDIS_HOST / REDIS_PORT for Nest)`);

  const backendRoot = path.resolve(__dirname, '..');
  const env = {
    ...process.env,
    REDIS_HOST: host,
    REDIS_PORT: String(port),
  };

  child = spawn('npx', ['nest', 'start', '--watch'], {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });

  child.on('exit', (code) => {
    void redisServer.stop().finally(() => process.exit(code ?? 0));
  });
}

main().catch((err) => {
  console.error('[dev] Failed to start embedded Redis:', err.message || err);
  process.exit(1);
});

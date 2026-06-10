import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined
}

const redis = global._redis ?? new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

if (process.env.NODE_ENV !== 'production') {
  global._redis = redis
}

export default redis

export async function register() {
  // Only run in the Node.js runtime (not in Edge or during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundRefresh } = await import('./lib/server-cache')
    startBackgroundRefresh()
  }
}

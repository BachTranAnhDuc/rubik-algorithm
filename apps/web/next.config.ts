import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ['@rubik/visualizer', '@rubik/cube-core', '@rubik/shared'],
}

export default config

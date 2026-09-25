/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow opening the app via 127.0.0.1 as well as localhost in dev.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

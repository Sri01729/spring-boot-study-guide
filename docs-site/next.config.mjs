/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [], // Add domains if needed for remote images
  },
  // Optional: Configure output for optimized builds
  output: 'standalone',
};

export default nextConfig;
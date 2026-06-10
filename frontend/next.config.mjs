/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone", // Only for Docker/self-hosted. Vercel uses default output
  images: {
    domains: ["localhost"],
  },
};

export default nextConfig;

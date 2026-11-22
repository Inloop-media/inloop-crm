/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep visited pages in the browser for 30s, so going back and forth is instant. Changes still show
    // straight away: every change pings the open tabs (LiveRefresh), which reloads the data.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;

const isProd = process.env.NODE_ENV === 'production';

export default {
    isProd: isProd,
    apiHost: isProd ? 'https://api.gitduck.com' : 'http://localhost:3001',
    websiteHost: isProd ? 'https://gitduck.com' : 'http://localhost:3000',
    // TODO: Create and change prod by live.gitduck.com
    liveHost: isProd ? 'live.gitduck.com' : 'localhost'
}

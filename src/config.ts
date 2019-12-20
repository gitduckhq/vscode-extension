const isProd = process.env.NODE_ENV === 'production';

export default {
    isProd: isProd,
    apiHost: isProd ? 'https://api.gitduck.com' : 'http://localhost:3001',
    websiteHost: isProd ? 'https://gitduck.com' : 'http://localhost:3000',
}

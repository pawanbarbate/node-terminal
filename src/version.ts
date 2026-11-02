import packageMetadata from '../package.json' with { type: 'json' };

export const appVersion = packageMetadata.version;

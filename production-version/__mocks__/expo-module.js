// Generic mock for expo and react-native modules
module.exports = new Proxy({}, {
    get: (_, prop) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return new Proxy({}, { get: () => () => null });
        return () => null;
    }
});

// Set up global fetch mock for API client tests
global.fetch = jest.fn();

// Silence noisy console in tests
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

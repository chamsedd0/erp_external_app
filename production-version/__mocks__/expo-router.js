module.exports = {
    useRouter: jest.fn(() => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
    Link: ({ children }) => children,
    Stack: ({ children }) => children,
    Slot: () => null,
};

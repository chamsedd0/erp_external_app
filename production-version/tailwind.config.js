/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter_400Regular'],
                heading: ['PlusJakartaSans_700Bold'],
                body: ['Inter_400Regular'],
                bold: ['PlusJakartaSans_700Bold'],
                medium: ['Inter_500Medium'],
                semibold: ['Inter_600SemiBold'],
            },
        },
    },
    plugins: [],
}

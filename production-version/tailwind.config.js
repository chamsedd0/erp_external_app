/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                sans: ['DMSans_400Regular'],
                heading: ['Outfit_700Bold'],
                body: ['DMSans_400Regular'],
                bold: ['Outfit_700Bold'],
                medium: ['DMSans_500Medium'],
                semibold: ['DMSans_700Bold'], // DM Sans bold is weight 700
            },
        },
    },
    plugins: [],
}

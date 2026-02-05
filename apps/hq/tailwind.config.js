/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // Enigma Design System 2.0 (Tactile Glass)
                enigma: {
                    void: '#0a0a0c', // Deepest background
                    surface: {
                        DEFAULT: 'rgba(255, 255, 255, 0.03)', // Card base
                        hover: 'rgba(255, 255, 255, 0.08)',   // Interact state
                    },
                    glass: {
                        border: 'rgba(255, 255, 255, 0.08)', // Subtle edge
                        stroke: 'rgba(255, 255, 255, 0.03)', // Separators
                    },
                    text: {
                        primary: '#ffffff',
                        secondary: '#a1a1aa', // Zinc 400
                        muted: '#52525b',     // Zinc 600
                    },
                    purple: {
                        DEFAULT: '#8b5cf6',
                        glow: 'rgba(139, 92, 246, 0.5)',
                    },
                    green: {
                        DEFAULT: '#10b981',
                        glow: 'rgba(16, 185, 129, 0.2)',
                    },
                    red: '#ef4444',
                }
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    from: { opacity: "0", transform: "translateY(10px)" },
                    to: { opacity: "1", transform: "translateY(0)" }
                },
                "scale-in": {
                    from: { transform: "scale(0.95)", opacity: "0" },
                    to: { transform: "scale(1)", opacity: "1" }
                }
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.4s ease-out",
                "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)", // Custom Apple-like curve
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

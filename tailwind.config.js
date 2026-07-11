/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        redisteca: {
          blue: '#1c3f73',        // azul marino de la "R" del logo
          blueDark: '#122a52',    // sombra del azul, para fondos/headers
          blueLight: '#3a5f9e',   // reflejo claro del azul del logo
          red: '#a31f24',         // rojo de la segunda "R" del logo
          redDark: '#7a1519',     // sombra del rojo
          redLight: '#c62f34',    // reflejo claro del rojo
          accent: '#a31f24'       // alias del rojo, para usarlo como acento
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}

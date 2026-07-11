# Redisteca App — Gestión (PWA)

App interna de gestión para Redisteca: inventario, cotizaciones, pedidos,
clientes, finanzas y notificaciones push, con roles y permisos
personalizados. Funciona como PWA instalable en iPhone y Android.

## Estado actual (Fase 1 — Fundación)

✅ Esquema completo de base de datos (Supabase/Postgres) con roles,
   permisos por módulo/acción, y seguridad a nivel de fila (RLS)
✅ Autenticación con correo/contraseña
✅ Sistema de roles personalizados (no limitado a niveles fijos)
✅ Navegación que se adapta automáticamente según los permisos del usuario
✅ Estructura PWA (instalable, funciona offline para lo ya cargado)
✅ Base de notificaciones push (Android completo; iPhone requiere
   agregar la app a inicio, ver abajo)

🔲 Pendiente (próximas fases): pantallas funcionales de Inventario,
   Cotizaciones, Pedidos, Clientes, Finanzas y Usuarios/Roles
   (por ahora son pantallas de marcador de posición)
🔲 Generación de PDF de cotizaciones
🔲 Reportes y gráficos
🔲 Disparo automático de notificaciones (cron de Supabase) para cuentas
   por vencer, entregas pendientes y stock bajo

## 1. Configurar Supabase (gratis)

1. Crea una cuenta en https://supabase.com y un proyecto nuevo.
2. En el panel del proyecto, ve a **SQL Editor** y pega todo el contenido
   de `supabase/schema.sql`. Ejecútalo (esto crea todas las tablas, los
   roles iniciales — Dueño, Gerente, Vendedor, Almacén, Cobranza — y sus
   permisos).
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`
4. Crea tu primer usuario: **Authentication → Users → Add user** (correo
   y contraseña). Esto disparará el trigger que crea su perfil
   automáticamente.
5. En **Table Editor → profiles**, edita ese usuario y ponle
   `role_id` = el id del rol "Dueño" (columna `id` en la tabla `roles`)
   para que tenga acceso total.

## 2. Configurar el proyecto localmente

```bash
npm install
cp .env.example .env
```

Edita `.env` con tu `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

```bash
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con el usuario que creaste.

## 3. Notificaciones push (opcional, cuando quieras activarlas)

1. Genera un par de llaves VAPID (una sola vez):
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Pon la llave pública en `.env` como `VITE_VAPID_PUBLIC_KEY`.
3. En Supabase, configura las variables de entorno de la Edge Function
   `send-push` (Project Settings → Edge Functions → Secrets):
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ej.
   `mailto:info@redisteca.com`).
4. Despliega la función:
   ```bash
   supabase functions deploy send-push
   ```

**Importante sobre iPhone:** Apple solo permite notificaciones push a
PWAs que el usuario haya agregado explícitamente a su pantalla de
inicio (botón compartir → "Agregar a inicio"), y requiere iOS 16.4 o
superior. Si el empleado solo la usa desde Safari sin instalarla, no
recibirá push — la app ya detecta esto y se lo avisa. En Android no hay
esa restricción: funciona desde el navegador o instalada.

## 4. Publicar la app en Cloudflare Pages (gratis)

Tienes dos formas de hacerlo. Si vas a hacer cambios y ajustes seguido,
la opción B (Wrangler) es la más rápida porque publicas directo desde
tu terminal sin pasar por Git cada vez.

### Opción A — Conectando tu repositorio de Git (recomendado para el día a día)

1. Sube este proyecto a un repo de GitHub/GitLab.
2. En https://dash.cloudflare.com → **Workers & Pages → Create → Pages
   → Connect to Git**.
3. Selecciona el repo. Configuración de build:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. En **Environment variables**, agrega `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` y `VITE_VAPID_PUBLIC_KEY` (las mismas de tu
   `.env`).
5. Deploy. Cada vez que hagas `git push`, Cloudflare vuelve a publicar
   automáticamente — sin gastar "créditos" por cambio, el plan gratis de
   Pages no cobra por build ni por los cambios que hagas.

### Opción B — Desde la terminal con Wrangler (para iterar rápido sin Git)

```bash
npm install -g wrangler
wrangler login

npm run build
wrangler pages deploy dist --project-name=redisteca-app
```

Cada vez que quieras publicar un cambio, repites solo las últimas dos
líneas. Te da una URL `https://redisteca-app.pages.dev` al instante, y
puedes conectar tu propio dominio después desde el panel si quieres
(ej. `app.redisteca.com`).

**Nota:** ya incluí en el proyecto el archivo `public/_redirects`
(necesario para que las rutas internas de la app, como `/inventario` o
`/clientes`, no den error 404 al recargar la página) y `wrangler.toml`.

### Instalarla en los teléfonos

Una vez publicada (con URL https, que Cloudflare Pages da automático):
- **iPhone:** abrir el link en Safari → botón compartir → "Agregar a
  inicio".
- **Android:** abrir el link en Chrome → aparece un aviso de "Instalar
  app" automáticamente (o menú ⋮ → "Instalar aplicación").


## Estructura del proyecto

```
src/
  components/    Layout, protección de rutas por permiso
  hooks/         notificaciones push
  lib/           cliente de Supabase
  pages/         una por módulo
  store/         estado de sesión y permisos (Zustand)
  types/         tipos compartidos
supabase/
  schema.sql             esquema completo + roles/permisos iniciales
  functions/send-push/   Edge Function para enviar push
public/
  sw-push.js     service worker de notificaciones
```

## Próximos pasos sugeridos

Dime cuál módulo quieres que construya primero (recomiendo Inventario,
porque Cotizaciones y Pedidos dependen de tener productos cargados) y
seguimos con la Fase 2.

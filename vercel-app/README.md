# Factúrate en Vercel

Frontend existente con Supabase Auth v2. La cuenta y nombre son reales; las funciones fiscales siguen como demostración. La aplicación privada de Sites permanece independiente.

Requisitos: Node 22.13+ y pnpm 11.25.0.

```sh
cd vercel-app
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm dev
```

Configuración opcional: copia `.env.example` a `.env.local`. Incluye exclusivamente la URL y publishable key, que son públicas. Nunca uses service_role ni una secret key en este frontend.

La migración `../supabase/migrations/20261111_perfiles.sql` ya fue ejecutada, después de verificar que la tabla no existía; no volver a ejecutarla sobre una tabla existente. RLS debe mantenerse habilitado.

Lee `../docs/breakout1-20261111.md` para alcance, decisiones y pruebas.

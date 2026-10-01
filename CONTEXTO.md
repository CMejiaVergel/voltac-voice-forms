# Contexto del proyecto — Voltac Voice Forms

## Resumen

**Voltac Voice Forms** es una aplicación web para capturar información de clientes potenciales de **Voltac** mediante voz. El usuario responde preguntas por micrófono; el navegador transcribe con la Web Speech API; los datos se envían a un flujo N8N que los procesa con Gemini, estructura un diagnóstico y envía un correo interno al equipo de Voltac.

**Marca correcta:** Voltac (no Voltak).

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Voz | Web Speech API (nativa del navegador, sin npm) |
| Backend / automatización | N8N (webhook + Gemini + email) |
| IA | Google Gemini (API Google AI Studio) |
| Despliegue | VPS (p. ej. Contabo) + Nginx + dominio (p. ej. Hostinger) |

---

## Estructura del código

```
src/
├── app/
│   ├── layout.tsx          # Layout global, metadata, estilos base
│   ├── page.tsx            # Página de inicio (bienvenida + enlace al formulario)
│   ├── formulario/page.tsx # Página del formulario de voz
│   └── globals.css         # Estilos globales (Tailwind)
├── components/
│   ├── VoiceForm.tsx       # Orquestador: preguntas, respuestas, envío al webhook
│   ├── QuestionCard.tsx    # Una pregunta + micrófono + textarea fallback + Siguiente/Repetir
│   ├── VoiceRecorder.tsx   # Botón de grabación y estados (idle/recording/done/error)
│   ├── ProgressBar.tsx     # Barra “Pregunta X de Y”
│   ├── CompletionScreen.tsx# Pantalla final (éxito o error con reintento)
│   └── BrowserCheck.tsx    # Comprueba Web Speech API, HTTPS y permisos de micrófono
├── hooks/
│   └── useSpeechToText.ts  # Hook para Web Speech API (es-CO, continuous, interimResults)
├── lib/
│   ├── questions.ts        # Array de 8 preguntas (nombre_empresa, actividad, etc.)
│   └── api.ts              # submitFormToN8N() → POST al webhook N8N
└── types/
    └── index.ts            # Question, Answer, FormSubmission, RecordingStatus
```

---

## Flujo de datos

1. **Usuario** abre `/formulario` → **BrowserCheck** valida soporte de voz, HTTPS y micrófono.
2. **VoiceForm** muestra una pregunta; el usuario graba con **VoiceRecorder** (o escribe en el textarea).
3. **useSpeechToText** devuelve `displayText` (en vivo) y `finalText` (para enviar).
4. Al pulsar “Siguiente” se guarda una **Answer** y se avanza; al terminar las 8 preguntas se construye **FormSubmission**.
5. **submitFormToN8N** hace POST al `NEXT_PUBLIC_N8N_WEBHOOK_URL` con `{ answers, metadata }`.
6. N8N: Webhook → consolidar texto → Gemini (diagnóstico en JSON) → parsear → enviar email.
7. El frontend muestra **CompletionScreen** (éxito o error con reintento).

---

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | URL del webhook N8N (ej. `https://n8n.tudominio.com/webhook/voltac-intake`). Debe ser HTTPS en producción. |

Archivo de ejemplo: `.env.local.example`. Copiar a `.env.local` y ajustar la URL.

---

## Diseño (Tailwind)

- Tema de color bajo la clave **voltac** en `tailwind.config.ts`: `voltac-bg`, `voltac-surface`, `voltac-accent`, `voltac-accentLight`, `voltac-blue`.
- Fondo oscuro (`#0f0a1a`), acentos morado/azul, texto claro.
- Layout centrado, `max-w-2xl` para el formulario, mobile-first.
- Botón de micrófono grande y circular; estado “grabando” con animación de pulso.

---

## Limitaciones importantes

- **Web Speech API:** Solo fiable en navegadores Chromium (Chrome, Edge, Brave). En otros navegadores se muestra el aviso y se usa solo el campo de texto.
- **HTTPS:** En producción el sitio debe servirse por HTTPS para que el reconocimiento de voz funcione (en localhost no es necesario).
- **Fallback:** Cada pregunta tiene un textarea para escribir si no hay voz o el usuario prefiere texto.

---

## Despliegue (resumen)

- **App en producción:** https://voice-forms.voltac.com.co (subdominio del dominio voltac.com.co en Hostinger).
- **N8N:** https://n8ndev.voltac.com.co/ — Webhook path: `voltac-voice-forms` → URL completa: `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`.
- **DNS:** Registro A para `voice-forms.voltac.com.co` hacia la IP del VPS.
- **VPS:** Node.js 20, Nginx, Certbot, PM2. Proyecto en `/var/www/voltac-voice-forms`, `npm run build`, `.env.local` con `NEXT_PUBLIC_N8N_WEBHOOK_URL`, `pm2 start`.
- **N8N CORS:** `N8N_CORS_ALLOWED_ORIGINS=https://voice-forms.voltac.com.co`. Flujo: Webhook → Set → HTTP a Gemini → Code (parsear JSON) → Respond to Webhook + Send Email. Variable `GEMINI_API_KEY`.

Guías paso a paso en **`docs/`**:
- **Despliegue en VPS con Setup Orion + Traefik:** `docs/DESPLIEGUE-VPS-SETUP-ORION-TRAEFIK.md` (orden estricto, sin tocar Traefik).
- **Flujo N8N (webhook, Gemini, email):** `docs/GUIA-FLUJO-N8N-VOLTAC-VOICE-FORMS.md`.

---

## Referencia del PRD

El proyecto se creó siguiendo el **PRD Técnico — Voltac Voice Intake App** (en el PRD original aparecía “Voltak” por error de transcripción; el nombre correcto de la solución es **Voltac**).

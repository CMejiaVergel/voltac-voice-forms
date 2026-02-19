# Voltac Voice Forms

Aplicativo web de captura de información de clientes potenciales de **Voltac** mediante voz. El usuario responde preguntas por micrófono, el sistema transcribe con Web Speech API, envía los datos a un flujo N8N que procesa con Gemini y envía un correo interno con el diagnóstico.

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Voz:** Web Speech API (navegador, sin paquetes npm)
- **Backend:** N8N (webhook + Gemini + email)

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local
# Editar .env.local con tu URL de webhook N8N
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El formulario de voz está en `/formulario`.

**Requisitos:** Chrome, Edge o Brave. HTTPS no es necesario en localhost.

**Nota Windows:** Si `npm run build` falla con un error de CSS/webpack (p. ej. "Unexpected token"), puede deberse a rutas con espacios. Prueba clonar o copiar el proyecto en una ruta sin espacios (ej. `C:\dev\voltac-voice-forms`) y volver a ejecutar `npm run build`.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | URL del webhook N8N (producción: `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`). Debe ser HTTPS en producción. |

## Despliegue en VPS (voltac.com.co)

- **App en producción:** https://voice-forms.voltac.com.co  
- **N8N:** https://n8ndev.voltac.com.co/  
- **Webhook:** https://n8ndev.voltac.com.co/webhook/voltac-voice-forms  

Guías detalladas en la carpeta `docs/`:
- **`docs/GUIA-FLUJO-N8N-VOLTAC-VOICE-FORMS.md`** — Crear el flujo en N8N (webhook, Gemini, email).
- **`docs/GUIA-DESPLIEGUE-VPS-VOLTAC-VOICE-FORMS.md`** — Desplegar la app en el VPS bajo voltac.com.co (DNS en Hostinger, Nginx, SSL, PM2).

## Estructura del proyecto

```
src/
├── app/              # Rutas y layout
├── components/       # VoiceForm, QuestionCard, VoiceRecorder, etc.
├── hooks/            # useSpeechToText
├── lib/              # questions, api (webhook)
└── types/
```

## Notas

- Web Speech API solo funciona en Chromium (Chrome, Edge, Brave) y con HTTPS en producción.
- Cada pregunta tiene fallback con campo de texto por si no hay voz o el usuario prefiere escribir.
- El PRD técnico completo describe el flujo N8N, el prompt de Gemini y la plantilla del correo.

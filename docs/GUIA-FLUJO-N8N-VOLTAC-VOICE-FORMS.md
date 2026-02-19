# Guía paso a paso: Flujo N8N para Voltac Voice Forms

Esta guía detalla cómo crear el flujo en N8N que recibe los datos del formulario de voz, los procesa con Gemini y envía un correo interno al equipo de Voltac.

**Requisitos previos:**
- N8N instalado y accesible en tu VPS: **https://n8ndev.voltac.com.co/**
- Cuenta en [Google AI Studio](https://aistudio.google.com/apikey) para obtener la API key de Gemini
- Credenciales SMTP (Gmail con contraseña de aplicación, SendGrid, o el servidor de correo que uses)

---

## Resumen del flujo

```
[Webhook] → [Set: consolidar texto] → [HTTP Request: Gemini] → [Code: parsear JSON] → [Respond to Webhook] + [Send Email]
```

El webhook recibirá POST desde la app en **https://voice-forms.voltac.com.co** (o desde localhost en desarrollo). La URL del webhook será:

**`https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`**

---

## Paso 1: Crear un nuevo workflow

1. Entra a **https://n8ndev.voltac.com.co/** e inicia sesión.
2. En la vista principal, haz clic en **"+ Add workflow"** (o **"Nuevo workflow"**).
3. Asigna un nombre al workflow, por ejemplo: **Voltac Voice Forms – Intake**.
4. Guarda (Ctrl+S o el botón **Save**).

---

## Paso 2: Nodo 1 – Webhook

1. Haz clic en **"+"** para añadir un nodo (o arrastra desde el panel izquierdo).
2. Busca **"Webhook"** y selecciónalo.
3. Configura el nodo así:

   | Campo | Valor |
   |-------|--------|
   | **HTTP Method** | POST |
   | **Path** | `voltac-voice-forms` |
   | **Response Mode** | When Last Node Finishes |
   | **Response Code** | 200 |

4. **Importante:** El path debe ser exactamente `voltac-voice-forms` (sin barras al inicio). La URL final del webhook será la que aparece en el nodo, algo como:
   `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`
5. Guarda el nodo (**Execute Node** no es necesario en webhooks; se activa al recibir la petición).
6. **Activa el workflow** con el interruptor **"Active"** en la esquina superior derecha. Sin esto, el webhook no responderá.

---

## Paso 3: Nodo 2 – Set (consolidar preguntas y respuestas)

Este nodo toma el JSON recibido del webhook y genera un único texto con todas las preguntas y respuestas para enviarlo a Gemini.

1. Añade un nodo después del Webhook (conecta la salida del Webhook a la entrada del nuevo nodo).
2. Busca **"Set"** (o **"Edit Fields"** en versiones recientes) y añádelo.
3. Configura:
   - **Mode:** Manual (o el que permita añadir un campo con expresión).
   - Añade un campo:
     - **Name:** `consolidated_text`
     - **Value:** (usa **Expression** / modo expresión) y pega lo siguiente:

```javascript
{{ $json.answers.map(a => `PREGUNTA: ${a.questionText}\nRESPUESTA: ${a.transcription}`).join('\n\n---\n\n') }}
```

4. Así se genera un texto tipo:
   ```
   PREGUNTA: ¿Cuál es tu nombre y el de tu empresa?
   RESPUESTA: Mi nombre es Carlos y tengo TransCargo...

   ---

   PREGUNTA: ¿A qué se dedica tu empresa?
   RESPUESTA: Logística nacional...
   ```
5. Guarda el nodo.

---

## Paso 4: Nodo 3 – HTTP Request (llamar a Gemini)

1. Añade un nodo después del Set.
2. Busca **"HTTP Request"** y selecciónalo.
3. Configura:

   | Campo | Valor |
   |-------|--------|
   | **Method** | POST |
   | **URL** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={{ $env.GEMINI_API_KEY }}` |

   Si en tu N8N las variables de entorno se acceden distinto (p. ej. `$credentials` o un nodo "Credentials"), usa la forma que tengas para inyectar la API key. Lo habitual es tener `GEMINI_API_KEY` en **Settings → Variables** de N8N.

4. **Headers:**
   - Añade: **Name** `Content-Type`, **Value** `application/json`.

5. **Body (Body Content Type: JSON):** pega el siguiente JSON. En el campo del prompt debes **insertar la expresión** que referencia el texto consolidado del nodo anterior. En N8N suele ser algo como `{{ $json.consolidated_text }}` dentro del texto:

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Eres un analista de negocios de Voltac, una agencia de inteligencia artificial y automatización. Tu trabajo es analizar las respuestas de un cliente potencial que completó un formulario de diagnóstico y generar un informe estructurado.\n\nA continuación están las respuestas del cliente:\n\n---\n{{ $json.consolidated_text }}\n---\n\nGenera un JSON con exactamente esta estructura (sin markdown, sin backticks, solo el JSON puro):\n\n{\n  \"nombre_cliente\": \"nombre extraído\",\n  \"empresa\": \"nombre de la empresa si lo mencionó\",\n  \"sector\": \"sector o industria identificada\",\n  \"problema_principal\": \"resumen conciso del problema en máximo 2 oraciones\",\n  \"proceso_actual\": \"cómo manejan el proceso actualmente\",\n  \"solucion_sugerida\": \"tipo de solución que podría ofrecerse: automatización, agente IA, chatbot, flujo automatizado, etc.\",\n  \"nivel_complejidad\": \"baja | media | alta\",\n  \"presupuesto_mencionado\": \"lo que mencionó o 'No especificado'\",\n  \"contacto_preferido\": \"medio de contacto que indicó\",\n  \"disponibilidad\": \"disponibilidad para reunión\",\n  \"notas_adicionales\": \"cualquier observación relevante que no encaje en los campos anteriores\",\n  \"resumen_ejecutivo\": \"párrafo de 3-5 oraciones resumiendo quién es el cliente, qué necesita y qué le podríamos ofrecer\"\n}"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.3,
    "maxOutputTokens": 1024
  }
}
```

6. **Obtener la API key de Gemini:**
   - Ve a [Google AI Studio – API keys](https://aistudio.google.com/apikey).
   - Crea una clave y cópiala.
   - En N8N: **Settings (engranaje) → Variables** (o Variables de entorno del servidor). Crea una variable:
     - **Name:** `GEMINI_API_KEY`
     - **Value:** (tu clave, sin espacios).
   - Reinicia N8N si es necesario para que cargue la variable.

7. Guarda el nodo.

---

## Paso 5: Nodo 4 – Code (extraer y parsear el JSON de Gemini)

La respuesta de Gemini viene envuelta en un objeto; hay que extraer el texto y parsearlo como JSON.

1. Añade un nodo **"Code"** después del HTTP Request.
2. **Mode:** Run Once for All Items (o el equivalente en tu versión).
3. **Language:** JavaScript.
4. **Código:**

```javascript
const geminiResponse = $input.first().json;
const rawText = geminiResponse.candidates[0].content.parts[0].text;

// Limpiar posibles backticks de markdown
const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
let parsed;

try {
  parsed = JSON.parse(cleanJson);
} catch (e) {
  // Si falla el parse, devolver un objeto con las respuestas crudas para el email
  return [{
    json: {
      nombre_cliente: 'Error al parsear',
      empresa: '-',
      sector: '-',
      problema_principal: rawText?.substring(0, 500) || 'Sin datos',
      proceso_actual: '-',
      solucion_sugerida: '-',
      nivel_complejidad: '-',
      presupuesto_mencionado: '-',
      contacto_preferido: '-',
      disponibilidad: '-',
      notas_adicionales: 'JSON de Gemini no válido. Revisar flujo.',
      resumen_ejecutivo: 'Revisar manualmente la respuesta de Gemini.'
    }
  }];
}

return [{ json: parsed }];
```

5. Guarda el nodo.

---

## Paso 6: Nodo 5 – Respond to Webhook (respuesta al frontend)

Para que la app sepa que todo salió bien, el flujo debe responder al webhook.

1. Añade el nodo **"Respond to Webhook"** (a veces dentro de la categoría Webhook).
2. Conéctalo **después del nodo Code** (usa la misma salida que irá al email).
3. Configura:
   - **Respond With:** JSON
   - **Response Body** (JSON):

```json
{
  "status": "success",
  "message": "Formulario procesado correctamente"
}
```

4. **Response Code:** 200.
5. Guarda el nodo.

---

## Paso 7: Nodo 6 – Send Email (enviar diagnóstico al equipo)

1. Añade un nodo **"Send Email"** (o **Gmail** si usas Gmail). Conéctalo a la **misma salida del nodo Code** (el Code puede tener dos conexiones: una a Respond to Webhook y otra a Send Email).
2. Configura las credenciales SMTP (o Gmail) en N8N si aún no lo has hecho.
3. En el nodo:

   | Campo | Valor / Expresión |
   |-------|-------------------|
   | **To** | El correo donde quieres recibir los leads (ej. `leads@voltac.com.co` o tu correo interno). |
   | **Subject** | `Nuevo Lead Voltac Voice Forms: {{ $json.nombre_cliente }} - {{ $json.empresa }}` |
   | **Email Type** | HTML |
   | **Message** | (ver bloque HTML abajo) |

4. **Cuerpo del mensaje (HTML):** pega el siguiente HTML. Las variables `{{ $json.nombre_cliente }}`, etc., son las que devolvió el nodo Code.

```html
<h2>Nuevo Lead – Voltac Voice Forms</h2>

<table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Cliente</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.nombre_cliente }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Empresa</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.empresa }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Sector</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.sector }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Problema Principal</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.problema_principal }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Proceso Actual</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.proceso_actual }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Solución Sugerida</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.solucion_sugerida }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Complejidad</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.nivel_complejidad }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Presupuesto</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.presupuesto_mencionado }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Contacto</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.contacto_preferido }}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; background: #f5f3ff; font-weight: bold;">Disponibilidad</td>
    <td style="padding: 8px; border: 1px solid #ddd;">{{ $json.disponibilidad }}</td>
  </tr>
</table>

<h3>Resumen Ejecutivo</h3>
<p>{{ $json.resumen_ejecutivo }}</p>

<h3>Notas Adicionales</h3>
<p>{{ $json.notas_adicionales }}</p>

<hr>
<p style="color: #888; font-size: 12px;">Generado automáticamente por Voltac Voice Forms</p>
```

5. Guarda el nodo.

---

## Paso 8: CORS en N8N (imprescindible para el frontend)

Para que el navegador pueda hacer POST desde **https://voice-forms.voltac.com.co** (o desde localhost) al webhook, N8N debe permitir ese origen.

1. **Si N8N corre con Docker:** en el `docker-compose` o en las variables del contenedor, añade:
   ```env
   N8N_CORS_ALLOWED_ORIGINS=https://voice-forms.voltac.com.co,http://localhost:3000
   ```
   Incluye `http://localhost:3000` solo si quieres probar en local.

2. **Si N8N corre con PM2 o systemd:** en el archivo de entorno (`.env` o el que use tu proceso), añade:
   ```env
   N8N_CORS_ALLOWED_ORIGINS=https://voice-forms.voltac.com.co
   ```
3. Reinicia N8N después de cambiar CORS.

---

## Paso 9: Activar el workflow y probar

1. Activa el workflow con el interruptor **Active** (arriba a la derecha).
2. Copia la **URL del webhook** que muestra el nodo Webhook:  
   `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`
3. En tu proyecto Voltac Voice Forms, en `.env.local`, define:
   ```env
   NEXT_PUBLIC_N8N_WEBHOOK_URL=https://n8ndev.voltac.com.co/webhook/voltac-voice-forms
   ```
4. Prueba enviando un POST desde la app (completando el formulario) o con una herramienta como Postman/curl con un JSON de ejemplo (estructura `answers` + `metadata` como en el PRD).

---

## Resumen de URLs y nombres

| Concepto | Valor |
|----------|--------|
| Instancia N8N | https://n8ndev.voltac.com.co/ |
| Path del webhook | `voltac-voice-forms` |
| URL completa del webhook | https://n8ndev.voltac.com.co/webhook/voltac-voice-forms |
| Variable de entorno en frontend | `NEXT_PUBLIC_N8N_WEBHOOK_URL` = URL anterior |
| CORS en N8N | `https://voice-forms.voltac.com.co` (y opcionalmente `http://localhost:3000`) |

Con esto el flujo N8N para **Voltac Voice Forms** queda listo y alineado con el nombre de la solución y el dominio voltac.com.co.

# Guía paso a paso: Flujo N8N para Voltac Voice Forms (v2 – Groq)

Esta guía detalla cómo crear el flujo en N8N que recibe los datos del formulario de voz, los procesa con **Groq** (API de chat compatible con OpenAI) y envía un correo interno al equipo de Voltac.

**Versión 2 (Groq)** – Incluye:

- Uso de **Groq** como proveedor de IA (cuenta gratuita, sin tarjeta; API key en [console.groq.com](https://console.groq.com)).
- Webhook con **Respond = "Using Respond to Webhook Node"** para evitar "Unused Respond to Webhook node".
- Uso de **`$json.body.answers`** en Edit Fields (body del POST en `body`).
- Nodo **Code** que construye el body de la petición a Groq (formato chat completions) con JSON siempre válido.
- Nodo **Code** que parsea la respuesta de Groq (formato `choices[0].message.content`).
- Orden: Code (parsear) → Respond to Webhook → Send Email.

**Requisitos previos:**

- N8N instalado y accesible (ej. **https://n8ndev.voltac.com.co/**).
- **API key de Groq:** regístrate en [console.groq.com](https://console.groq.com), crea una API key y guárdala (no la pegues en la guía; usa variable de entorno `GROQ_API_KEY` en n8n).
- Credenciales SMTP (Gmail, SendGrid, etc.).

---

## Resumen del flujo (orden de nodos)

```
[Webhook] → [Edit Fields] → [Code: body Groq] → [HTTP Request: Groq] → [Code: parsear JSON] → [Respond to Webhook] → [Send Email]
```

- El **Webhook** recibe el POST desde **https://voice-forms.voltac.com.co** (o localhost en desarrollo).
- URL del webhook: **`https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`**.

---

## Paso 1: Crear el workflow

1. Entra a tu instancia de N8N (ej. **https://n8ndev.voltac.com.co/**) e inicia sesión.
2. **"+ Add workflow"** (o **"Nuevo workflow"**).
3. Nombre del workflow, por ejemplo: **Voltac Voice Forms – Intake**.
4. Guarda (Ctrl+S o **Save**).

---

## Paso 2: Nodo Webhook

1. Añade un nodo **Webhook** (busca "Webhook" en el panel de nodos).
2. Configura:

   | Campo | Valor |
   |-------|--------|
   | **HTTP Method** | POST |
   | **Path** | `voltac-voice-forms` |
   | **Respond** | **Using Respond to Webhook Node** |
   | **Response Code** | 200 |

3. **Importante:** El parámetro **Respond** debe ser exactamente **"Using Respond to Webhook Node"**. Si está en "When Last Node Finishes" u otra opción sin indicar el nodo de respuesta, n8n mostrará "Unused Respond to Webhook node found in the workflow" y el webhook fallará.
4. El path debe ser `voltac-voice-forms` (sin barras al inicio). La URL final será la que muestre el nodo (ej. `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`).
5. Guarda el nodo.

---

## Paso 3: Nodo Edit Fields (consolidar preguntas y respuestas)

Este nodo toma el JSON del webhook y genera un único texto con todas las preguntas y respuestas para el prompt de IA.

1. Añade un nodo **Edit Fields** (o **Set**) **después del Webhook** y conecta la salida del Webhook a su entrada.
2. Configura:
   - **Mode:** Manual (o el que permita añadir un campo con expresión).
   - Añade un campo:
     - **Name:** `consolidated_text`
     - **Value:** usa **Expression** y pega la expresión siguiente.

En n8n 2.8.x (self-hosted) el body del POST suele llegar en `$json.body`, no en `$json` directamente. Usa esta expresión:

```javascript
{{ $json.body.answers.map(a => `PREGUNTA: ${a.questionText}\nRESPUESTA: ${a.transcription}`).join('\n\n---\n\n') }}
```

3. Si en tu instalación el webhook entrega el body en la raíz (sin `body`), en **Executions** verás `answers` directamente en el item. En ese caso usa en su lugar:

   `{{ $json.answers.map(a => \`PREGUNTA: ${a.questionText}\nRESPUESTA: ${a.transcription}\`).join('\n\n---\n\n') }}`

4. El resultado será un texto tipo:

   ```
   PREGUNTA: ¿Cuál es tu nombre y el de tu empresa o negocio?
   RESPUESTA: Carlos Mejía y trabajo para la empresa voltaje

   ---

   PREGUNTA: ¿A qué se dedica tu empresa?
   RESPUESTA: mi empresa es del sector eléctrico
   ```

5. Guarda el nodo.

---

## Paso 4: Nodo Code – Construir body para Groq (JSON válido)

Groq expone una API compatible con OpenAI Chat Completions: `POST https://api.groq.com/openai/v1/chat/completions` con header `Authorization: Bearer <API_KEY>` y body con `model` y `messages`. Para no romper el JSON al insertar el texto del usuario, construimos todo el body en un nodo Code.

1. Añade un nodo **Code** después de **Edit Fields** y conecta la salida de Edit Fields a su entrada.
2. **Mode:** Run Once for All Items (o equivalente).
3. **Language:** JavaScript.
4. Pega el siguiente código. La API key debe venir de la variable de entorno **`GROQ_API_KEY`** (configurada en el stack de n8n en Portainer para todos los servicios, incluido el worker). No escribas la clave real en el código.

```javascript
const item = $input.first().json;
const consolidatedText = item.consolidated_text || '';

// Usar variable de entorno GROQ_API_KEY (definida en el stack n8n en Portainer)
const apiKey = $env.GROQ_API_KEY || '';

const promptText = `Eres un analista de negocios de Voltac, una agencia de inteligencia artificial y automatización. Tu trabajo es analizar las respuestas de un cliente potencial que completó un formulario de diagnóstico y generar un informe estructurado.

A continuación están las respuestas del cliente:

---
${consolidatedText}
---

Genera un JSON con exactamente esta estructura (sin markdown, sin backticks, solo el JSON puro):

{
  "nombre_cliente": "nombre extraído",
  "empresa": "nombre de la empresa si lo mencionó",
  "sector": "sector o industria identificada",
  "problema_principal": "resumen conciso del problema en máximo 2 oraciones",
  "proceso_actual": "cómo manejan el proceso actualmente",
  "solucion_sugerida": "tipo de solución que podría ofrecerse: automatización, agente IA, chatbot, flujo automatizado, etc.",
  "nivel_complejidad": "baja | media | alta",
  "presupuesto_mencionado": "lo que mencionó o 'No especificado'",
  "contacto_preferido": "medio de contacto que indicó",
  "disponibilidad": "disponibilidad para reunión",
  "notas_adicionales": "cualquier observación relevante que no encaje en los campos anteriores",
  "resumen_ejecutivo": "párrafo de 3-5 oraciones resumiendo quién es el cliente, qué necesita y qué le podríamos ofrecer"
}`;

// Formato Groq / OpenAI Chat Completions
const groqBody = {
  model: 'llama-3.3-70b-versatile',
  messages: [
    {
      role: 'user',
      content: promptText
    }
  ],
  temperature: 0.3,
  max_tokens: 1024
};

return [{
  json: {
    groqBody,
    apiKey
  }
}];
```

5. **Modelos Groq disponibles (campo `model`):** Puedes cambiar `llama-3.3-70b-versatile` por otro, por ejemplo:
   - `llama-3.3-70b-versatile` – Llama 3.3 70B (recomendado).
   - `llama-3.1-8b-instant` – Más rápido, menos capacidad.
   - `openai/gpt-oss-120b` – GPT-OSS 120B (si está disponible en tu cuenta).
6. Guarda el nodo. La salida tendrá `groqBody` (objeto para el body del HTTP Request) y `apiKey` (para el header Authorization).

---

## Paso 5: Nodo HTTP Request (llamar a Groq)

La API de Groq es: `POST https://api.groq.com/openai/v1/chat/completions` con header `Authorization: Bearer <API_KEY>` y body en formato Chat Completions (model, messages).

**Conexión correcta (evita "JSON parameter needs to be valid JSON"):** El nodo **HTTP Request** debe recibir la entrada **solo** desde el **Code del Paso 4** (el que construye `groqBody` y `apiKey`). Si el HTTP Request recibe la entrada desde **Edit Fields**, `$json.groqBody` no existirá y el body no será JSON válido. En la ejecución, comprueba que el **Input** del nodo HTTP Request muestre el **Code** (con `groqBody` y `apiKey`), no "Edit Fields". Si ves "Edit Fields", elimina esa conexión y conecta únicamente: **Code (Paso 4) → HTTP Request**.

1. Añade un nodo **HTTP Request** después del **Code** del Paso 4. Conecta **solo** la salida de ese Code a la entrada del HTTP Request (no conectes Edit Fields al HTTP Request).
2. Configura:

   | Campo | Valor |
   |-------|--------|
   | **Method** | POST |
   | **URL** | `https://api.groq.com/openai/v1/chat/completions` |

3. **Headers** – Añade estos dos (uno por uno):
   - **Name:** `Content-Type` → **Value:** `application/json`
   - **Name:** `Authorization` → **Value:** `Bearer {{ $json.apiKey }}`

   Así la clave que devolvió el Code (desde `$env.GROQ_API_KEY`) se envía en el header. Si en tu n8n la variable de entorno no está disponible en el Code, puedes poner en el nodo HTTP Request una credencial de tipo "Header Auth" con el valor `Bearer <tu_clave>` y usarla en lugar de la expresión; lo recomendable es usar `GROQ_API_KEY` en el environment del stack.

4. **Body:**
   - **Body Content Type:** JSON.
   - **Specify Body:** Using JSON (o expresión).
   - En el campo del body usa **solo** la expresión que devuelve el objeto construido en el Code del Paso 4:
   - **`{{ $json.groqBody }}`**

   Con esto el body es siempre JSON válido (model, messages, temperature, max_tokens).

5. Guarda el nodo.

---

## Paso 6: Nodo Code – Extraer y parsear el JSON de Groq

La respuesta de Groq usa el formato OpenAI Chat Completions: el texto generado está en `choices[0].message.content`. Este nodo extrae ese texto y lo parsea como JSON.

1. Añade un nodo **Code** después del **HTTP Request** y conecta la salida del HTTP Request a su entrada.
2. **Mode:** Run Once for All Items.
3. **Language:** JavaScript.
4. Código:

```javascript
const groqResponse = $input.first().json;

// Groq/OpenAI format: choices[0].message.content
const rawText = groqResponse.choices?.[0]?.message?.content || '';

const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
let parsed;

try {
  parsed = JSON.parse(cleanJson);
} catch (e) {
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
      notas_adicionales: 'JSON de Groq no válido. Revisar flujo.',
      resumen_ejecutivo: 'Revisar manualmente la respuesta de Groq.'
    }
  }];
}

return [{ json: parsed }];
```

5. Guarda el nodo.

---

## Paso 7: Nodo Respond to Webhook

1. Añade el nodo **Respond to Webhook**. Conéctalo **después del nodo Code** del Paso 6 (el que parsea el JSON).
2. Configura:
   - **Respond With:** JSON
   - **Response Body:**

```json
{
  "status": "success",
  "message": "Formulario procesado correctamente"
}
```

   - **Response Code:** 200

3. Guarda el nodo.

---

## Paso 8: Nodo Send Email

1. Añade el nodo **Send Email** (o **Gmail**). Conéctalo **después de Respond to Webhook** (salida del mismo Code del Paso 6): Code (parsear) → Respond to Webhook y Code (parsear) → Send Email.
2. Configura credenciales SMTP en N8N si aún no lo has hecho.
3. En el nodo:

   | Campo | Valor / Expresión |
   |-------|-------------------|
   | **To** | Correo donde recibir los leads (ej. `leads@voltac.com.co`). |
   | **Subject** | `Nuevo Lead Voltac Voice Forms: {{ $json.nombre_cliente }} - {{ $json.empresa }}` |
   | **Email Type** | HTML |
   | **Message** | (bloque HTML abajo) |

4. Cuerpo del mensaje (HTML) – las variables son las devueltas por el Code del Paso 6:

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

## Paso 9: CORS en N8N

Para que el navegador en **https://voice-forms.voltac.com.co** pueda hacer POST al webhook, N8N debe permitir ese origen.

1. En el stack/contenedor de N8N (ej. Portainer → stack n8n → variables de entorno), añade o edita:
   ```env
   N8N_CORS_ALLOWED_ORIGINS=https://voice-forms.voltac.com.co
   ```
   Opcionalmente añade `,http://localhost:3000` si pruebas en local.
2. Reinicia los servicios de N8N que correspondan para que carguen la variable.

---

## Paso 10: Activar el workflow y probar

1. Activa el workflow con el interruptor **Active** (arriba a la derecha).
2. Copia la **URL del webhook** que muestra el nodo Webhook (ej. `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`).
3. En el proyecto Voltac Voice Forms, en `.env.local`:
   ```env
   NEXT_PUBLIC_N8N_WEBHOOK_URL=https://n8ndev.voltac.com.co/webhook/voltac-voice-forms
   ```
4. Haz build y reinicia la app si cambiaste la URL. Prueba completando el formulario desde la app.

---

## Resumen de URLs y nombres

| Concepto | Valor |
|----------|--------|
| Instancia N8N | https://n8ndev.voltac.com.co/ |
| Path del webhook | `voltac-voice-forms` |
| URL completa del webhook | https://n8ndev.voltac.com.co/webhook/voltac-voice-forms |
| Variable en frontend | `NEXT_PUBLIC_N8N_WEBHOOK_URL` = URL anterior |
| CORS en N8N | `https://voice-forms.voltac.com.co` |

---

## API key de Groq (variable de entorno en self-hosted)

1. **Obtener la API key:** Entra a [console.groq.com](https://console.groq.com), inicia sesión y crea una API key (o usa la que ya te dieron). **No la pegues en la documentación ni en el código;** úsala solo en variables de entorno o credenciales.
2. **En N8N con Docker Swarm (Portainer):** La variable **GROQ_API_KEY** debe estar en el **environment** de **todos** los servicios que ejecutan nodos (n8n_web, n8n_webhook, n8n_worker, etc.). En Portainer → Stacks → n8n → Editor, en la sección `environment:` de cada servicio que corresponda a n8n, añade:

   ```yaml
   - GROQ_API_KEY=tu_clave_groq_aqui
   ```

   Sustituye `tu_clave_groq_aqui` por tu API key real (la que ves en [console.groq.com](https://console.groq.com)).
3. **Reiniciar servicios:** Después de guardar el stack, reinicia todos los servicios del stack n8n para que carguen la nueva variable.
4. En el nodo **Code** del Paso 4 se usa `$env.GROQ_API_KEY`; el nodo **HTTP Request** del Paso 5 envía esa clave en el header `Authorization: Bearer {{ $json.apiKey }}` (el Code devuelve `apiKey` desde `$env.GROQ_API_KEY`).

**Referencia rápida de la API Groq (para revisar en la documentación oficial):**

- **URL:** `https://api.groq.com/openai/v1/chat/completions`
- **Método:** POST
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <API_KEY>`
- **Body:** `{ "model": "llama-3.3-70b-versatile", "messages": [ { "role": "user", "content": "..." } ], "temperature": 0.3, "max_tokens": 1024 }`
- **Respuesta:** Formato OpenAI; el texto en `choices[0].message.content`.

Con esta guía (v2 – Groq) el flujo usa Groq como proveedor de IA y evita los errores de "Unused Respond to Webhook node" y "JSON parameter needs to be valid JSON".

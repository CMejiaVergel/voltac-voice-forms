# Despliegue de Voltac Voice Forms en VPS con Setup Orion y Traefik

Guía **paso a paso, en orden estricto**, para desplegar la aplicación Voltac Voice Forms en un VPS donde **Setup Orion** ya está instalado. Todo el tráfico HTTPS y los subdominios los gestiona **Traefik**; esta guía **no modifica** la configuración de Traefik y añade la app como un servicio más (stack) mediante labels, igual que el resto de aplicativos.

---

## Contexto del VPS (Setup Orion V2.8.0)

El VPS está configurado así:

| Componente | Origen | Función |
|------------|--------|--------|
| **Setup Orion V2.8.0** | Instalador usado para desplegar los stacks. | Instala y configura Portainer + Traefik, y luego el resto de herramientas con el mismo flujo. |
| **Portainer** | Stack instalado vía Orion. | Interfaz web para ver y gestionar todos los stacks y servicios (Docker Swarm). Acceso: `https://portainerdev.voltac.com.co`. |
| **Traefik** | Stack instalado vía Orion. | Único punto de entrada en puertos 80/443; enruta por subdominio (labels) y gestiona certificados HTTPS. **No se modifica** desde esta guía. |
| **Minio** | Stack instalado vía Orion (después de Traefik). | Almacenamiento de objetos (S3-compatible). |
| **n8n** | Stack instalado vía Orion (autohost). | Automatización y webhooks; Voltac Voice Forms envía los datos aquí. Postgres se instaló como dependencia de n8n. |
| **postgres** | Stack/dependencia de n8n. | Base de datos que usa n8n. |

Todos estos stacks se ven en Portainer en **Stacks** (`portainerdev.voltac.com.co` → Stacks): `minio`, `n8n`, `portainer`, `postgres`, `traefik`. Voltac Voice Forms se desplegará como **un stack más** (p. ej. `voltac-voice-forms`), con un contenedor proxy que lleva las labels de Traefik; no se modifica Traefik, n8n, Minio ni Postgres. La aplicación Next.js corre en el **host** con Node.js + PM2 (puerto 3000); el stack solo expone el proxy que Traefik enruta por el subdominio `voice-forms.voltac.com.co`.

---

## Principios (importante)

- **Traefik** es el único que escucha en los puertos 80 y 443. No instales Nginx ni Certbot para este subdominio en el host.
- **No se toca** la configuración global de Traefik (ni `docker service update --args`, ni `--configFile`, ni montajes extra en el servicio de Traefik).
- Voltac Voice Forms se expone **solo** mediante un **nuevo servicio** en Docker (proxy con labels de Traefik) que se une a la **misma red** que Traefik.
- La app corre en el **host** (Node.js + PM2 en el puerto 3000); el proxy en Docker solo reenvía el tráfico desde Traefik al host.

---

## Errores pasados que NO debes repetir

| Qué pasó antes | Qué hacer ahora |
|----------------|-----------------|
| Se ejecutó `docker service update traefik_traefik --args "..."` con una lista incompleta o solo `--configFile`, y Traefik dejó de enrutar (n8n y demás dejaron de funcionar). | **Nunca** hagas `docker service update traefik_traefik --args` ni añadas montajes/config a Traefik. |
| Se intentó usar Nginx en el host en 80/443 para voice-forms, entrando en conflicto con Traefik. | No uses Nginx para este subdominio. Traefik gestiona 80/443; la app se expone solo vía el proxy con labels. |
| Se añadieron archivos de configuración o certificados dentro del servicio de Traefik. | Certificados y rutas se gestionan con **labels** en el nuevo servicio (certresolver de Traefik) y con la red compartida. |
| El backend (n8n) daba 502 porque no estaba en la red que Traefik usa. | El nuevo servicio de proxy **debe** estar en la **misma red** que Traefik (la que indique Setup Orion). |

---

## Orden de ejecución (resumen)

1. Tener Setup Orion instalado y funcionando (Traefik + n8n accesibles).
2. DNS: registro A para `voice-forms.voltac.com.co` → IP del VPS.
3. En el VPS: Node.js 20, git, clonar repo, build, PM2 en puerto 3000.
4. Descubrir el nombre de la red Docker que usa Traefik.
5. Crear y desplegar el stack del proxy (labels Traefik + red de Traefik).
6. Configurar CORS en n8n y variable de entorno en la app.
7. Probar en el navegador.

---

## Paso 1 – Prerrequisitos (Setup Orion ya instalado)

- VPS con **Ubuntu**.
- **Setup Orion V2.8.0** ya ejecutado: al menos los stacks **Portainer**, **Traefik**, **n8n** (y opcionalmente Minio, etc.) instalados y visibles en Portainer.
- Acceso a **Portainer** (`https://portainerdev.voltac.com.co`) y acceso **SSH** al VPS como usuario con sudo.
- Dominio **voltac.com.co** (ej. en Hostinger) para crear el subdominio `voice-forms.voltac.com.co`.

**Comprobar antes de seguir:** en Portainer → Stacks deben aparecer `traefik`, `n8n`, `portainer` (y los que hayas instalado). Abre la URL de n8n que uses (ej. `https://n8ndev.voltac.com.co`) y confirma que carga; así Traefik está enrutando bien.

---

## Paso 2 – DNS: subdominio hacia el VPS

En el panel de tu proveedor de dominio (ej. Hostinger):

1. Crear un **registro tipo A**:
   - **Nombre / host:** `voice-forms` (el subdominio será `voice-forms.voltac.com.co`).
   - **Valor / apunta a:** IP pública del VPS.
   - TTL: 300 o por defecto.

2. Guardar y esperar unos minutos (hasta 24 h en casos raros). Opcional: comprobar con:
   ```bash
   dig +short voice-forms.voltac.com.co
   ```
   Debe devolver la IP del VPS.

---

## Paso 3 – Preparar el VPS (Node.js, git, carpeta)

Conéctate por SSH al VPS y ejecuta **en este orden**:

**3.1 – Instalar Node.js 20 LTS**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # debe ser v20.x
```

**3.2 – Instalar git (si no está)**

```bash
sudo apt-get update
sudo apt-get install -y git
```

**3.3 – Crear carpeta para la aplicación**

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
cd /var/www
```

---

## Paso 4 – Clonar el repositorio y construir la app

**4.1 – Clonar** (sustituye `TU_USUARIO` por tu usuario de GitHub y, si es privado, usa token o SSH):

```bash
cd /var/www
git clone https://github.com/TU_USUARIO/Voltac_Voice_Forms.git
cd Voltac_Voice_Forms
```

**4.2 – Variables de entorno**

La app necesita la URL del webhook de N8N. Crea `.env.local`:

```bash
nano .env.local
```

Contenido (ajusta la URL si Orion expone n8n con otro subdominio):

```env
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://n8ndev.voltac.com.co/webhook/voltac-voice-forms
```

Guarda (Ctrl+O, Enter, Ctrl+X).

**4.3 – Instalar dependencias y build**

```bash
npm ci
npm run build
```

Si hay errores de compilación, revísalos antes de seguir.

**4.4 – Probar en local (opcional)**

```bash
npm run start
```

En otra terminal (o desde tu PC con `ssh -L 3000:127.0.0.1:3000 user@vps`) abre `http://127.0.0.1:3000`. Detén el proceso con Ctrl+C cuando termines de probar.

---

## Paso 5 – Ejecutar la app con PM2 (puerto 3000)

La app debe estar siempre activa y escuchando **solo en localhost** para que solo el proxy (y Traefik) la alcancen.

**5.1 – Instalar PM2**

```bash
sudo npm install -g pm2
```

**5.2 – Arrancar la app con PM2**

Desde la raíz del proyecto:

```bash
cd /var/www/Voltac_Voice_Forms
pm2 start npm --name "voltac-voice-forms" -- start
```

**5.3 – Comportamiento al reinicio y guardar proceso**

```bash
pm2 save
pm2 startup
```

Ejecuta el comando que te imprima `pm2 startup` (suele ser algo como `sudo env PATH=... pm2 startup systemd -u tu_usuario --hp /home/tu_usuario`).

**5.4 – Comprobar**

```bash
pm2 status
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
```

Debe devolver `200`. La app **no** debe escuchar en `0.0.0.0:3000` si no quieres exponerla directamente; Next por defecto escucha en `0.0.0.0:3000`. Para dejarla solo en localhost puedes usar:

```bash
pm2 delete voltac-voice-forms
pm2 start npm --name "voltac-voice-forms" -- start -- -H 127.0.0.1
pm2 save
```

(Next acepta `-H 127.0.0.1` para escuchar solo en localhost.)

---

## Paso 6 – Descubrir la red Docker de Traefik

El proxy que vamos a crear **debe** estar en la **misma red** que Traefik para que Traefik pueda enrutar a él. Con Setup Orion (Portainer + Swarm), Traefik suele usar una red compartida (por ejemplo `traefik_web`, `traefik_public` o similar).

**6.1 – Por Portainer (recomendado)**

1. En Portainer (`https://portainerdev.voltac.com.co`) → menú izquierdo **Networks**.
2. Revisa la lista de redes. La que use el stack **traefik** es la que necesitas (suele tener un nombre que incluye "traefik" o el nombre del stack).
3. Entra al stack **traefik** → pestaña **Services** → abre el servicio de Traefik → **Advanced** / detalles del servicio y revisa en qué **networks** está conectado. Anota ese nombre exacto como `RED_DE_TRAEFIK`.

**6.2 – Por SSH (alternativa)**

```bash
docker network ls
docker service ls | grep -i traefik
docker service inspect traefik_traefik --format '{{json .Spec.TaskTemplate.Networks}}' | jq
```

O inspeccionar el contenedor en ejecución:

```bash
docker ps --filter "name=traefik" --format "{{.ID}}"
docker inspect <CONTAINER_ID> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

Anota el **nombre exacto** de la red (por ejemplo `traefik_web` o `traefik_public`). Lo usarás en el siguiente paso como `RED_DE_TRAEFIK`.

**6.3 – (Opcional) Nombre del certificado resolver de Traefik**

Si más adelante el certificado HTTPS no se emite para voice-forms, comprueba cómo se llama el resolver ACME en Traefik:

```bash
docker service inspect traefik_traefik --format '{{join .Spec.TaskTemplate.ContainerSpec.Args " "}}' | tr ' ' '\n' | grep -i certresolver
```

O revisa la documentación de Setup Orion. En las labels usamos `letsencryptresolver`; si en tu instalación es otro (ej. `letsencrypt`), cámbialo en el Paso 7.

---

## Paso 7 – Crear y desplegar el stack del proxy (Traefik labels)

Este servicio **solo** hace de proxy entre Traefik y la app en el host (puerto 3000). Traefik enruta por las **labels**; no se toca la configuración global de Traefik.

**7.1 – Crear directorio y archivo de configuración de Nginx**

```bash
sudo mkdir -p /opt/voltac-voice-forms-proxy
sudo nano /opt/voltac-voice-forms-proxy/voice-forms.conf
```

Contenido del archivo (proxy al host; en Linux, `172.17.0.1` es la IP por defecto del host desde la red `bridge`; si el proxy no puede conectar, más abajo se indica cómo usar la IP real del host):

```nginx
server {
    listen 80;
    location / {
        proxy_pass http://172.17.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Usar `X-Forwarded-Proto https` (y no `$scheme`) asegura que la app reciba que la petición original fue HTTPS, ya que Traefik termina SSL y reenvía al proxy por HTTP.

Guarda y cierra.

**7.2 – Crear el compose del stack**

Sustituye `RED_DE_TRAEFIK` por el nombre real obtenido en el Paso 6 (ej. `orion_public` o `VOLTACNET`). Si el certificado Let's Encrypt en Traefik usa un resolver con otro nombre (ej. `letsencrypt`), cambia `letsencryptresolver` por ese nombre.

```bash
sudo nano /opt/voltac-voice-forms-proxy/docker-compose.yml
```

Contenido:

```yaml
services:
  voice-forms-proxy:
    image: nginx:alpine
    deploy:
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.voice-forms.rule=Host(`voice-forms.voltac.com.co`)"
        - "traefik.http.routers.voice-forms.entrypoints=websecure"
        - "traefik.http.routers.voice-forms.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.voice-forms.loadbalancer.server.port=80"
    volumes:
      - /opt/voltac-voice-forms-proxy/voice-forms.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - traefik_net

networks:
  traefik_net:
    external: true
    name: RED_DE_TRAEFIK
```

**Importante:** donde pone `RED_DE_TRAEFIK` en `name:`, pon el nombre **exacto** de la red (ej. `name: orion_public` o `name: VOLTACNET`). El nombre del resolver TLS (`letsencryptresolver`) debe coincidir con el que use Setup Orion en Traefik; si no lo sabes, déjalo y si el certificado no se emite, revisa los logs de Traefik o la documentación de Orion.

**7.3 – Desplegar el stack**

**Opción A – Por SSH (Swarm)**  
Con Setup Orion suele usarse Docker Swarm:

```bash
cd /opt/voltac-voice-forms-proxy
docker stack deploy -c docker-compose.yml voltac-voice-forms
```

**Opción B – Por Portainer**  
1. En Portainer → **Stacks** → **Add stack**.  
2. Nombre: `voltac-voice-forms`.  
3. Pega el contenido del `docker-compose.yml` (con `RED_DE_TRAEFIK` ya sustituido por el nombre real de la red).  
4. **Deploy the stack**.  
El stack aparecerá en la lista junto a `traefik`, `n8n`, `minio`, etc., y podrás ver logs y estado desde ahí.

**Opción C – Docker Compose sin Swarm**  
Si en tu entorno no usas Swarm:

```bash
cd /opt/voltac-voice-forms-proxy
docker compose up -d
```

**7.4 – Comprobar que el servicio está en la red y corriendo**

- **Por Portainer:** Stacks → `voltac-voice-forms` → Services; el servicio debe estar en estado Running. En **Networks** (menú izquierdo) puedes ver que el contenedor del proxy está en la misma red que Traefik.
- **Por SSH:**
  ```bash
  docker service ls | grep voice-forms
  # o
  docker ps | grep voice-forms
  docker network inspect RED_DE_TRAEFIK --format '{{range .Containers}}{{.Name}} {{end}}'
  ```
Debe aparecer el contenedor del proxy en la red de Traefik.

---

## Paso 8 – CORS en n8n

Para que el frontend en `https://voice-forms.voltac.com.co` pueda llamar al webhook de n8n desde el navegador, n8n debe incluir ese origen en CORS. Si no lo haces, al enviar el formulario verás un error de CORS en la consola y la petición será bloqueada.

**8.1 – Abrir el stack n8n en Portainer**

1. Entra a Portainer: `https://portainerdev.voltac.com.co`.
2. Menú izquierdo → **Stacks**.
3. En la lista, haz clic en el stack **n8n** (no en el servicio de postgres; el que corresponde a la aplicación n8n).

**8.2 – Editar el stack para añadir la variable de entorno**

4. Dentro del stack n8n, busca el botón **Editor** (o **Stack editor** / **Duplicate and redeploy**, según la versión de Portainer). Si solo ves "Inspect" o "Web editor", usa la opción que permita editar el YAML del stack.
5. En el archivo YAML, localiza el **servicio** de n8n (el contenedor que ejecuta la imagen de n8n, no el de postgres). Suele tener un bloque `environment:` o `env:`.
6. Añade o modifica la variable de entorno exactamente así (sin espacios alrededor del `=`, sin comillas en el valor a menos que el formato del stack las requiera):

   ```yaml
   N8N_CORS_ALLOWED_ORIGINS: https://voice-forms.voltac.com.co
   ```

   Si ya existe `N8N_CORS_ALLOWED_ORIGINS` con otros orígenes, añade el nuevo separado por coma, por ejemplo:

   ```yaml
   N8N_CORS_ALLOWED_ORIGINS: https://voice-forms.voltac.com.co,https://n8ndev.voltac.com.co
   ```

7. Guarda los cambios en el editor (botón **Update the stack** o **Save**).

**8.3 – Reiniciar el servicio n8n**

8. Vuelve a la vista del stack n8n (o a **Services** en el menú izquierdo).
9. Localiza el **servicio** de n8n (nombre tipo `n8n_n8n` o similar).
10. Entra al servicio → opción **Recreate** / **Restart** para que cargue la nueva variable. En Swarm suele ser "Recreate" o "Update the service" con "Force update" para que arranque una nueva tarea.
11. Espera a que el estado pase a **Running** (puede tardar unos segundos).

**8.4 – Comprobar que CORS está activo**

12. Abre la URL de n8n en el navegador (ej. `https://n8ndev.voltac.com.co`) y confirma que la interfaz carga con normalidad.
13. Más adelante, en el Paso 10, al enviar el formulario desde `https://voice-forms.voltac.com.co` no debe aparecer error de CORS en la consola del navegador (F12 → pestaña Console). Si aparece, revisa que el valor de `N8N_CORS_ALLOWED_ORIGINS` sea exactamente `https://voice-forms.voltac.com.co` (con `https://`, sin barra final).

---

## Paso 9 – Crear el flujo en n8n (webhook voltac-voice-forms)

Este paso configura el flujo que recibe los datos del formulario de voz, los procesa (p. ej. con Gemini) y responde o envía un correo. Si ya tienes el flujo creado, verifica que la ruta del webhook y la URL coincidan con la que usa la app.

**9.1 – Abrir n8n**

1. Entra a la URL de n8n (ej. `https://n8ndev.voltac.com.co`).
2. Inicia sesión si es necesario.

**9.2 – Crear o abrir el flujo**

3. Si es la primera vez: **Add workflow** (o **Nuevo flujo**). Si ya tienes el flujo de Voltac Voice Forms, ábrelo y pasa al **9.4**.
4. Pon un nombre al flujo si quieres (ej. "Voltac Voice Forms").

**9.3 – Añadir el nodo Webhook**

5. Añade un nodo **Webhook** (búsqueda en el panel de nodos o en "Trigger").
6. Configura el webhook:
   - **HTTP Method:** POST.
   - **Path:** escribe exactamente `voltac-voice-forms` (sin barras al inicio ni al final, sin espacios).
   - **Authentication:** None (o según tu criterio; el flujo de la guía no usa auth en el webhook).
7. Guarda el nodo. La URL de producción que n8n muestra debe ser del tipo:  
   `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`  
   (el subdominio puede ser otro si así lo configuraste en Traefik; lo importante es que esa sea la URL que pusiste en `.env.local` como `NEXT_PUBLIC_N8N_WEBHOOK_URL`).

**9.4 – Comprobar coincidencia con la app**

8. En el VPS, revisa el contenido de `/var/www/Voltac_Voice_Forms/.env.local`. Debe contener una línea como:
   ```env
   NEXT_PUBLIC_N8N_WEBHOOK_URL=https://n8ndev.voltac.com.co/webhook/voltac-voice-forms
   ```
   La URL debe ser **exactamente** la que muestra el nodo Webhook en n8n (mismo dominio, mismo path, HTTPS). Si cambiaste el path en n8n, actualiza `.env.local` y vuelve a hacer build y reiniciar PM2:
   ```bash
   cd /var/www/Voltac_Voice_Forms && npm run build && pm2 restart voltac-voice-forms
   ```

**9.5 – Completar el flujo (procesamiento y respuesta)**

9. Añade el resto de nodos según el flujo que uses: por ejemplo **Set** (para dar formato a los datos), **HTTP Request** (llamada a Gemini), **Code** (parsear JSON), **Respond to Webhook** (devolver respuesta al formulario), **Send Email**, etc.
10. **Activa el flujo** (toggle "Active" en la esquina superior derecha del workflow). Sin esto, el webhook no responderá.
11. Guía detallada del flujo (nodos, variables, CORS): `docs/GUIA-FLUJO-N8N-VOLTAC-VOICE-FORMS.md`.

---

## Paso 10 – Verificación

Comprueba cada punto en este orden para asegurarte de que nada queda suelto.

**10.1 – App en el host (PM2)**

1. Por SSH en el VPS:
   ```bash
   pm2 status
   ```
   El proceso `voltac-voice-forms` debe estar en estado **online**.
2. Comprueba que la app responde en localhost:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
   ```
   Debe devolver `200`. Si devuelve `000` o error, revisa `pm2 logs voltac-voice-forms`.

**10.2 – DNS**

3. Comprueba que el subdominio apunta al VPS:
   ```bash
   dig +short voice-forms.voltac.com.co
   ```
   Debe mostrar la IP pública del VPS. Si no, revisa el registro A en tu proveedor de dominio.

**10.3 – Stack proxy y Traefik**

4. En Portainer → **Stacks** → `voltac-voice-forms`: el servicio debe estar en **Running**.
5. En **Services** (o dentro del stack), el servicio del proxy no debe tener tareas en estado Failed. Si hay Failed, revisa los logs del servicio.

**10.4 – Navegador: carga de la app**

6. Abre `https://voice-forms.voltac.com.co` en el navegador (mejor en ventana de incógnito o sin extensiones que modifiquen peticiones para evitar caché).
7. Debe cargar la portada de Voltac Voice Forms ("Comenzar diagnóstico"). Si ves 502, el proxy no llega a la app (revisa PM2 y que el proxy use la IP correcta del host).

**10.5 – Navegador: envío del formulario (integración con n8n)**

8. Haz clic en **Comenzar diagnóstico** y entra a `/formulario`.
9. Completa al menos una pregunta (puedes usar el texto o el micrófono) y avanza hasta enviar el formulario.
10. Abre las herramientas de desarrollador (F12) → pestaña **Network**. Envía de nuevo si hace falta y localiza la petición al webhook (URL que contenga `/webhook/voltac-voice-forms`). Comprueba:
    - **Status:** debe ser 200 (o 2xx). Si es 4xx o 5xx, revisa el flujo en n8n y los logs del servicio n8n en Portainer.
    - En la pestaña **Console** no debe aparecer error de CORS (ej. "blocked by CORS policy"). Si aparece, vuelve al Paso 8 y verifica `N8N_CORS_ALLOWED_ORIGINS`.
11. La pantalla final debe mostrar el mensaje de éxito (o el que hayas configurado en el flujo). Si n8n envía correo, comprueba que llegue.

**10.6 – Resumen de comprobaciones**

| Comprobación | Dónde | Qué debe verse |
|--------------|--------|----------------|
| PM2 | `pm2 status` | voltac-voice-forms **online** |
| App local | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000` | `200` |
| DNS | `dig +short voice-forms.voltac.com.co` | IP del VPS |
| Stack proxy | Portainer → Stacks → voltac-voice-forms | Servicio **Running** |
| CORS | Navegador F12 → Console al enviar formulario | Sin error "CORS" |
| Webhook | Navegador F12 → Network → petición a /webhook/voltac-voice-forms | Status 2xx |
| Flujo n8n | n8n → workflow | Toggle **Active** activado |

---

## Resumen del orden (checklist)

- [ ] Setup Orion V2.8.0 instalado; en Portainer se ven los stacks traefik, n8n, portainer (y minio, postgres si aplica).
- [ ] DNS: A `voice-forms.voltac.com.co` → IP del VPS.
- [ ] VPS: Node 20, git, `/var/www/Voltac_Voice_Forms` clonado.
- [ ] `.env.local` con `NEXT_PUBLIC_N8N_WEBHOOK_URL` (URL de n8n que uses, ej. n8ndev.voltac.com.co).
- [ ] `npm ci && npm run build`.
- [ ] PM2: `voltac-voice-forms` en marcha (y opcionalmente solo en `127.0.0.1:3000`).
- [ ] Red de Traefik identificada (Portainer → Networks o `docker service inspect traefik_traefik`).
- [ ] Stack `voltac-voice-forms` desplegado (SSH o Portainer → Add stack) en esa red con labels (Host, websecure, certresolver).
- [ ] CORS en n8n: `N8N_CORS_ALLOWED_ORIGINS=https://voice-forms.voltac.com.co` (editar stack n8n en Portainer si aplica).
- [ ] Flujo n8n con webhook `voltac-voice-forms`.
- [ ] Prueba en navegador (`https://voice-forms.voltac.com.co`) y envío de formulario.

---

## Si algo falla

- **502 Bad Gateway** al abrir voice-forms: el proxy no llega a la app. Comprueba que PM2 está activo (`pm2 status`) y que `curl http://127.0.0.1:3000` desde el host responde. Desde el contenedor del proxy prueba: `docker exec <proxy_container> wget -q -O- http://172.17.0.1:3000`. Si falla, en el compose añade `extra_hosts: - "host.docker.internal:host-gateway"` al servicio y en el .conf usa `proxy_pass http://host.docker.internal:3000` (o usa la IP de la interfaz `eth0` del host en lugar de `172.17.0.1`).
- **502 en n8n:** n8n debe estar en la misma red que Traefik. En Portainer revisa que el stack n8n tenga el servicio en esa red; no modifiques Traefik.
- **Certificado no válido** para voice-forms: Traefik debe poder hacer el reto ACME (HTTP o DNS). Revisa el nombre del `certresolver` en las labels y los logs de Traefik.
- **CORS / bloqueo al enviar:** revisa `N8N_CORS_ALLOWED_ORIGINS` y que la URL del webhook en `.env.local` sea exactamente la que usa n8n (HTTPS, sin barra final en la ruta del webhook).

---

## Error HTTP 500 al enviar el formulario (diagnóstico)

El mensaje **"Error HTTP: 500"** en la app significa que la petición **sí llegó** al webhook de n8n, pero **algo falló dentro del flujo** y n8n respondió con código 500. **No** está causado por usar HTTP en la URL del webhook (la app usa la variable `NEXT_PUBLIC_N8N_WEBHOOK_URL`, que debe ser HTTPS). El aviso "No es seguro" del navegador es un tema aparte (contenido mixto o cabeceras).

### Cómo ver exactamente qué falló en n8n

1. Entra a **n8n** (ej. `https://n8ndev.voltac.com.co`).
2. Menú izquierdo → **Executions** (o **Ejecuciones**).
3. Localiza la ejecución más reciente que corresponda al envío del formulario (hora similar a cuando pulsaste enviar). Suele aparecer en **rojo** o con estado **Error**.
4. Haz clic en esa ejecución. Se abre el detalle con el **grafo del flujo** y el **nodo que falló** marcado en rojo.
5. Haz clic en el **nodo en rojo**. En el panel derecho verás el **mensaje de error** (ej. "Cannot read property 'map' of undefined", "Request failed with status 401", "GEMINI_API_KEY is not set").
6. Anota el **nombre del nodo** que falló y el **texto del error**. Con eso se puede corregir el flujo.

### Causas habituales y qué revisar

| Nodo que falla | Causa probable | Qué hacer |
|----------------|----------------|-----------|
| **Set** (consolidar texto) | El webhook no entrega `answers` donde el nodo lo espera. En algunas versiones de n8n el body del POST viene en `$json.body`, no en `$json` directamente. | En el nodo Set, en la expresión del campo `consolidated_text`, prueba usar **`$json.body.answers`** en lugar de **`$json.answers`**. La expresión quedaría igual pero referenciando `$json.body.answers.map(a => ...)` (misma lógica que en la guía del flujo). Para saber cuál usar: en Executions, abre el nodo Webhook y mira la salida; si ves `body` con `answers` dentro, usa `$json.body.answers`. |
| **HTTP Request** (Gemini) | API key de Gemini no configurada, incorrecta o URL mal formada. | En n8n: **Settings** (engranaje) → **Variables** (o Variables de entorno del stack en Portainer). Crea o edita `GEMINI_API_KEY` con la clave de [Google AI Studio](https://aistudio.google.com/apikey). Reinicia el servicio n8n para que cargue la variable. Comprueba que la URL del nodo use `{{ $env.GEMINI_API_KEY }}` (o la sintaxis de variables de tu versión). |
| **HTTP Request** (Gemini) | Gemini devuelve error (límite, modelo no disponible, etc.). | En la ejecución, abre el nodo HTTP Request y revisa la respuesta (status 4xx/5xx y el cuerpo). Ajusta modelo, cuota o prompt según el mensaje. |
| **Code** (parsear JSON) | La respuesta de Gemini no tiene la estructura esperada (`candidates[0].content.parts[0].text`) o el texto no es JSON válido. | En la ejecución, abre el nodo **HTTP Request** y mira el JSON de respuesta. Si hay `error` o no hay `candidates`, Gemini falló antes; corrige el nodo HTTP Request o la API key. Si el Code falla al hacer `JSON.parse`, en la guía del flujo se incluye un `try/catch` que devuelve un objeto por defecto; asegúrate de que el código del nodo Code sea exactamente el de la guía (incluyendo el fallback). |
| **Respond to Webhook** | No se ejecuta porque un nodo anterior falló. | El 500 es la respuesta por defecto cuando el flujo termina con error. Corrige el nodo que falla (arriba); cuando el flujo termine bien, Respond to Webhook enviará 200. |

### Comprobar el payload que envía la app

En el navegador, F12 → **Network** → envía el formulario de nuevo → clic en la petición a `voltac-voice-forms` → pestaña **Payload** (o **Request**). Debes ver un JSON con `answers` (array de objetos con `questionId`, `questionKey`, `questionText`, `transcription`, `timestamp`) y `metadata` (`submittedAt`, `userAgent`, `language`). Si falta `answers` o tiene otro formato, el problema está en la app; si el formato es correcto, el fallo está en cómo el flujo de n8n lee ese body (por ejemplo usando `$json.body` en lugar de `$json`).

Siguiendo este orden y **sin modificar Traefik**, el despliegue no interrumpe el resto de servicios gestionados por Setup Orion.

# Guía paso a paso: Despliegue de Voltac Voice Forms en VPS (voltac.com.co)

Esta guía detalla cómo desplegar la aplicación **Voltac Voice Forms** en tu VPS y publicarla bajo el dominio **voltac.com.co** (adquirido en Hostinger). La app quedará accesible en:

**https://voice-forms.voltac.com.co**

---

## Requisitos previos

- **VPS** con Ubuntu 22.04 o 24.04 LTS (por ejemplo Contabo), con acceso SSH.
- **Dominio** voltac.com.co gestionado en Hostinger.
- N8N ya instalado y funcionando en el mismo VPS (o en otro), en **https://n8ndev.voltac.com.co/**.
- Flujo N8N de Voltac Voice Forms creado y activo (ver `GUIA-FLUJO-N8N-VOLTAC-VOICE-FORMS.md`).

---

## Resumen de pasos

1. Crear el registro DNS en Hostinger para `voice-forms.voltac.com.co`.
2. En el VPS: instalar Node.js 20, Nginx, Certbot y PM2 (si no están).
3. Subir o clonar el proyecto en el VPS.
4. Configurar variables de entorno y compilar.
5. Configurar Nginx como reverse proxy para `voice-forms.voltac.com.co`.
6. Obtener certificado SSL con Certbot.
7. Iniciar la app con PM2 y configurar arranque automático.
8. Verificar que la app responde y que el formulario envía al webhook.

---

## Paso 1: Registrar el subdominio en Hostinger (DNS)

Debes apuntar el subdominio **voice-forms.voltac.com.co** a la IP pública de tu VPS.

1. Entra al **panel de Hostinger** donde gestionas voltac.com.co.
2. Abre la sección de **Dominios** y selecciona **voltac.com.co**.
3. Entra a **Zona DNS** / **DNS Zone** / **Administrar DNS** (el nombre puede variar).
4. Crea un **nuevo registro**:
   - **Tipo:** A
   - **Nombre / Host:** `voice-forms` (solo el subdominio; algunos paneles piden `voice-forms.voltac.com.co`, otros solo `voice-forms`).
   - **Apunta a / Valor:** la **IP pública de tu VPS** (ej. la IP de Contabo).
   - **TTL:** 14400 o el que venga por defecto.
5. Guarda los cambios. La propagación puede tardar unos minutos hasta 24–48 horas (suele ser rápido).
6. (Opcional) Comprueba desde tu PC:
   ```bash
   ping voice-forms.voltac.com.co
   ```
   Debería resolver a la IP del VPS.

**Importante:** Si N8N está en el mismo VPS, esa IP ya puede tener un registro (por ejemplo para `n8ndev.voltac.com.co`). Para Voltac Voice Forms solo necesitas **otro registro A** con nombre `voice-forms` apuntando a la **misma IP**.

---

## Paso 2: Conectarte al VPS e instalar dependencias

1. Conéctate por SSH (sustituye `usuario` y `IP_VPS`):
   ```bash
   ssh usuario@IP_VPS
   ```

2. Actualizar el sistema:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. Instalar Nginx y Certbot (para SSL):
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

4. Instalar Node.js 20 LTS (si no lo tienes):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
   Comprueba:
   ```bash
   node -v   # debe ser v20.x
   npm -v
   ```

5. Instalar PM2 globalmente (para mantener la app corriendo):
   ```bash
   sudo npm install -g pm2
   ```

---

## Paso 3: Subir el proyecto al VPS

Tienes dos opciones: clonar por Git o subir los archivos por SCP/SFTP.

### Opción A: Clonar con Git

Si el proyecto está en un repositorio (GitHub, GitLab, etc.):

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/TU_USUARIO/voltac-voice-forms.git
sudo chown -R $USER:$USER /var/www/voltac-voice-forms
cd /var/www/voltac-voice-forms
```

### Opción B: Subir con SCP desde tu PC (Windows PowerShell o CMD)

En tu **máquina local** (donde está el proyecto), desde la carpeta del proyecto (sin incluir `node_modules` ni `.next`):

```bash
scp -r . usuario@IP_VPS:/var/www/voltac-voice-forms
```

Luego en el VPS:

```bash
ssh usuario@IP_VPS
cd /var/www/voltac-voice-forms
```

---

## Paso 4: Instalar dependencias y configurar entorno

1. En el VPS, dentro del proyecto:
   ```bash
   cd /var/www/voltac-voice-forms
   npm install
   ```

2. Crear el archivo de variables de entorno:
   ```bash
   nano .env.local
   ```
   Contenido (una sola línea, sin espacios alrededor del `=`):
   ```env
   NEXT_PUBLIC_N8N_WEBHOOK_URL=https://n8ndev.voltac.com.co/webhook/voltac-voice-forms
   ```
   Guarda (Ctrl+O, Enter) y cierra (Ctrl+X).

3. Compilar la aplicación:
   ```bash
   npm run build
   ```
   Si hay errores, revisa que Node sea v18+ y que `.env.local` exista.

---

## Paso 5: Configurar Nginx (reverse proxy)

1. Crear el archivo de sitio para `voice-forms.voltac.com.co`:
   ```bash
   sudo nano /etc/nginx/sites-available/voice-forms.voltac.com.co
   ```

2. Pega la configuración siguiente. Más adelante Certbot añadirá las líneas de SSL.

   ```nginx
   server {
       listen 80;
       server_name voice-forms.voltac.com.co;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. Guarda y cierra. Activa el sitio y comprueba la configuración:
   ```bash
   sudo ln -s /etc/nginx/sites-available/voice-forms.voltac.com.co /etc/nginx/sites-enabled/
   sudo nginx -t
   ```
   Debe decir "syntax is ok" y "test is successful".

4. Recargar Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

---

## Paso 6: Certificado SSL con Certbot

1. Ejecuta Certbot para el dominio (respondiendo las preguntas si las hace):
   ```bash
   sudo certbot --nginx -d voice-forms.voltac.com.co
   ```
2. Indica tu correo si lo pide y acepta los términos. Elige redirigir HTTP a HTTPS (recomendado).
3. Certbot modificará el archivo de Nginx y añadirá las directivas `ssl_certificate` y `ssl_certificate_key`. No es necesario editar nada a mano.
4. Comprueba que HTTPS responde:
   ```bash
   curl -I https://voice-forms.voltac.com.co
   ```
   Debe devolver `200` o `304` (aún no tendrás la app corriendo si no has arrancado PM2).

---

## Paso 7: Iniciar la aplicación con PM2

1. Desde la carpeta del proyecto:
   ```bash
   cd /var/www/voltac-voice-forms
   pm2 start npm --name "voltac-voice-forms" -- start
   ```

2. Comprobar que está en ejecución:
   ```bash
   pm2 status
   pm2 logs voltac-voice-forms --lines 20
   ```

3. Guardar la lista de procesos para que se recupere tras reinicios:
   ```bash
   pm2 save
   ```

4. Configurar el arranque automático al reiniciar el VPS:
   ```bash
   pm2 startup
   ```
   Ejecuta el comando que te muestre la salida (suele ser algo como `sudo env PATH=... pm2 startup systemd -u usuario --hp /home/usuario`).

---

## Paso 8: Verificación final

1. Abre en el navegador: **https://voice-forms.voltac.com.co**
   - Debe cargar la página de bienvenida de Voltac Voice Forms.
2. Entra a **https://voice-forms.voltac.com.co/formulario**
   - Debe cargar el formulario de voz (y el aviso de navegador si no es Chromium).
3. Completa las 8 preguntas (puedes usar el campo de texto si no usas micrófono) y envía.
   - Debe aparecer la pantalla "Gracias por tu tiempo" y en N8N debe ejecutarse el flujo y llegar el correo.

Si algo falla:
- Revisa `pm2 logs voltac-voice-forms`.
- Revisa CORS en N8N (`N8N_CORS_ALLOWED_ORIGINS=https://voice-forms.voltac.com.co`).
- Revisa que `NEXT_PUBLIC_N8N_WEBHOOK_URL` en `.env.local` sea exactamente `https://n8ndev.voltac.com.co/webhook/voltac-voice-forms`.

---

## Resumen de URLs y rutas

| Concepto | Valor |
|----------|--------|
| Dominio raíz | voltac.com.co (Hostinger) |
| App Voltac Voice Forms | https://voice-forms.voltac.com.co |
| Formulario de voz | https://voice-forms.voltac.com.co/formulario |
| N8N | https://n8ndev.voltac.com.co/ |
| Webhook N8N | https://n8ndev.voltac.com.co/webhook/voltac-voice-forms |
| Proyecto en VPS | /var/www/voltac-voice-forms |
| Proceso PM2 | voltac-voice-forms (puerto 3000) |
| Sitio Nginx | /etc/nginx/sites-available/voice-forms.voltac.com.co |

---

## Comandos útiles después del despliegue

| Acción | Comando |
|--------|--------|
| Ver estado de la app | `pm2 status` |
| Ver logs en vivo | `pm2 logs voltac-voice-forms` |
| Reiniciar la app | `pm2 restart voltac-voice-forms` |
| Parar la app | `pm2 stop voltac-voice-forms` |
| Recompilar tras cambios | `cd /var/www/voltac-voice-forms && npm run build && pm2 restart voltac-voice-forms` |
| Comprobar Nginx | `sudo nginx -t && sudo systemctl status nginx` |
| Renovar SSL (automático con certbot) | `sudo certbot renew --dry-run` (prueba) |

Con esto el despliegue de **Voltac Voice Forms** en tu VPS bajo **voltac.com.co** queda completo y alineado con el nombre de la solución.

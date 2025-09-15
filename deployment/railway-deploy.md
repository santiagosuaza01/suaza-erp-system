# 🚂 Despliegue en Railway - Sistema Suaza

Railway es una de las opciones más fáciles y económicas para desplegar el Sistema Suaza en la nube.

## 📋 Requisitos Previos

1. **Cuenta de GitHub** (gratuita)
2. **Cuenta de Railway** (gratuita con límites)
3. **Repositorio en GitHub** con el código de Suaza

## 🚀 Pasos para Desplegar

### 1. Preparar el Repositorio

```bash
# Subir el código a GitHub
git init
git add .
git commit -m "Initial commit - Sistema Suaza"
git branch -M main
git remote add origin https://github.com/tu-usuario/suaza.git
git push -u origin main
```

### 2. Configurar Railway

1. **Ir a [Railway.app](https://railway.app)**
2. **Crear cuenta** con GitHub
3. **Crear nuevo proyecto**
4. **Seleccionar "Deploy from GitHub repo"**
5. **Conectar tu repositorio de Suaza**

### 3. Configurar Variables de Entorno

En Railway, ir a la pestaña "Variables" y agregar:

```env
# Base de datos (Railway crea automáticamente)
DATABASE_URL=postgresql://...

# JWT Secrets
JWT_SECRET=tu-super-secret-jwt-key-cambiar-en-produccion
JWT_REFRESH_SECRET=tu-super-secret-refresh-key-cambiar-en-produccion

# Configuración del servidor
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://tu-dominio.railway.app

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
EMAIL_FROM=noreply@suaza.com

# DIAN (configurar cuando tengas las credenciales)
DIAN_API_KEY=tu-dian-api-key
DIAN_CERT_PATH=/app/certificates/cert.p12
DIAN_CERT_PASSWORD=tu-cert-password
```

### 4. Configurar Servicios

Railway detectará automáticamente los servicios. Configurar:

#### Backend Service
- **Build Command**: `cd backend && npm install && npm run build`
- **Start Command**: `cd backend && npm start`
- **Port**: `3001`

#### Frontend Service
- **Build Command**: `cd frontend && npm install && npm run build`
- **Start Command**: `cd frontend && npm start`
- **Port**: `3000`

### 5. Configurar Base de Datos

1. **Agregar servicio PostgreSQL** desde Railway
2. **Copiar la URL de conexión** a las variables de entorno
3. **Ejecutar migraciones**:

```bash
# En la consola de Railway o localmente
cd backend
npx prisma migrate deploy
npx prisma db seed
```

### 6. Configurar Dominio Personalizado (Opcional)

1. **Ir a la pestaña "Settings"**
2. **Agregar dominio personalizado**
3. **Configurar DNS** según las instrucciones

## 💰 Costos Estimados

- **Railway Free Tier**: $5 de crédito mensual
- **PostgreSQL**: ~$5-10/mes
- **Dominio**: ~$10-15/año
- **Total**: ~$15-25/mes para una agropecuaria pequeña

## 🔧 Configuración para Múltiples Usuarios

### Escalabilidad
- **Railway** escala automáticamente según el tráfico
- **PostgreSQL** puede manejar cientos de usuarios concurrentes
- **CDN** incluido para archivos estáticos

### Roles y Permisos
El sistema ya incluye:
- ✅ **ADMIN**: Control total
- ✅ **CAJERO**: Ventas y facturación
- ✅ **BODEGUERO**: Inventario
- ✅ **CONTADOR**: Reportes
- ✅ **PROVEEDOR**: Consulta de facturas
- ✅ **CLIENTE**: Estado de cuenta

## 📊 Monitoreo y Logs

Railway proporciona:
- **Logs en tiempo real**
- **Métricas de rendimiento**
- **Alertas automáticas**
- **Backups automáticos**

## 🔒 Seguridad

- **HTTPS automático**
- **Variables de entorno seguras**
- **Base de datos aislada**
- **Backups automáticos**

## 🚀 Despliegue Automático

Una vez configurado:
- **Cada push a GitHub** despliega automáticamente
- **Rollback automático** si hay errores
- **Zero-downtime deployments**

## 📱 Acceso Móvil

Los usuarios pueden acceder desde:
- 📱 **Smartphones** (responsive design)
- 💻 **Tablets**
- 🖥️ **Computadoras**
- 📊 **Puntos de venta**

## 🆘 Soporte

Si necesitas ayuda:
1. **Documentación Railway**: https://docs.railway.app
2. **Comunidad**: Discord de Railway
3. **Soporte Suaza**: soporte@suaza.com

## ✅ Verificación del Despliegue

Después del despliegue, verificar:

1. **Frontend**: https://tu-app.railway.app
2. **Backend API**: https://tu-app.railway.app/api/health
3. **Base de datos**: Conectar con Prisma Studio
4. **Logs**: Revisar en Railway Dashboard

¡Con Railway tendrás el Sistema Suaza funcionando en la nube en menos de 30 minutos! 🚀 
# 🚀 Despliegue en Heroku - Sistema Suaza

Heroku es una plataforma en la nube muy popular y fácil de usar para desplegar aplicaciones web.

## 📋 Requisitos Previos

1. **Cuenta de Heroku** (gratuita con límites)
2. **Heroku CLI** instalado
3. **Git** configurado
4. **Repositorio en GitHub**

## 🚀 Pasos para Desplegar

### 1. Instalar Heroku CLI

```bash
# Windows (con chocolatey)
choco install heroku

# O descargar desde: https://devcenter.heroku.com/articles/heroku-cli
```

### 2. Login a Heroku

```bash
heroku login
```

### 3. Crear Aplicación en Heroku

```bash
# Crear aplicación
heroku create suaza-agropecuaria

# O desde el dashboard web
# https://dashboard.heroku.com/new
```

### 4. Configurar Base de Datos

```bash
# Agregar PostgreSQL
heroku addons:create heroku-postgresql:mini

# Verificar la URL de la base de datos
heroku config:get DATABASE_URL
```

### 5. Configurar Variables de Entorno

```bash
# Configurar variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=tu-super-secret-jwt-key-cambiar-en-produccion
heroku config:set JWT_REFRESH_SECRET=tu-super-secret-refresh-key-cambiar-en-produccion
heroku config:set FRONTEND_URL=https://suaza-agropecuaria.herokuapp.com

# Email (opcional)
heroku config:set SMTP_HOST=smtp.gmail.com
heroku config:set SMTP_PORT=587
heroku config:set SMTP_USER=tu-email@gmail.com
heroku config:set SMTP_PASS=tu-app-password
heroku config:set EMAIL_FROM=noreply@suaza.com

# DIAN (cuando tengas credenciales)
heroku config:set DIAN_API_KEY=tu-dian-api-key
heroku config:set DIAN_CERT_PASSWORD=tu-cert-password
```

### 6. Configurar Buildpacks

```bash
# Configurar buildpacks para Node.js
heroku buildpacks:set heroku/nodejs

# Agregar buildpack para PostgreSQL
heroku buildpacks:add heroku/postgresql
```

### 7. Configurar Procfile

Crear archivo `Procfile` en la raíz del proyecto:

```
web: cd backend && npm start
```

### 8. Configurar package.json Principal

Agregar script de postinstall en el `package.json` principal:

```json
{
  "scripts": {
    "postinstall": "cd backend && npm install && cd ../frontend && npm install && npm run build",
    "start": "cd backend && npm start"
  }
}
```

### 9. Desplegar la Aplicación

```bash
# Agregar todos los archivos
git add .

# Commit
git commit -m "Deploy to Heroku"

# Push a Heroku
git push heroku main

# O si usas master
git push heroku master
```

### 10. Ejecutar Migraciones

```bash
# Ejecutar migraciones de la base de datos
heroku run cd backend && npx prisma migrate deploy

# Ejecutar seed (datos iniciales)
heroku run cd backend && npx prisma db seed
```

### 11. Verificar el Despliegue

```bash
# Abrir la aplicación
heroku open

# Ver logs
heroku logs --tail
```

## 🔧 Configuración para Múltiples Usuarios

### Escalabilidad
- **Heroku** escala automáticamente con dynos
- **PostgreSQL** puede manejar cientos de usuarios
- **CDN** automático para archivos estáticos

### Dynos Recomendados
- **Free Tier**: Para desarrollo/pruebas
- **Hobby ($7/mes)**: Para agropecuarias pequeñas
- **Standard ($25/mes)**: Para agropecuarias medianas
- **Performance ($250/mes)**: Para agropecuarias grandes

## 💰 Costos Estimados

- **Heroku Hobby**: $7/mes
- **PostgreSQL Mini**: $5/mes
- **Dominio personalizado**: $10-15/año
- **Total**: ~$12-15/mes

## 📱 Configuración Móvil

El sistema es completamente responsive:
- ✅ **Smartphones**
- ✅ **Tablets**
- ✅ **Computadoras**
- ✅ **Puntos de venta**

## 🔒 Seguridad

- **HTTPS automático**
- **Variables de entorno seguras**
- **Base de datos aislada**
- **Backups automáticos**

## 📊 Monitoreo

```bash
# Ver métricas
heroku ps

# Ver logs en tiempo real
heroku logs --tail

# Monitorear base de datos
heroku pg:info
```

## 🚀 Despliegue Automático

### Conectar con GitHub

1. **Ir a Heroku Dashboard**
2. **Seleccionar tu app**
3. **Deploy tab**
4. **Connect to GitHub**
5. **Habilitar automatic deploys**

### Configurar CI/CD

```yaml
# .github/workflows/heroku-deploy.yml
name: Deploy to Heroku
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: akhileshns/heroku-deploy@v3.12.12
      with:
        heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
        heroku_app_name: "suaza-agropecuaria"
        heroku_email: "tu-email@example.com"
```

## 🔧 Comandos Útiles

```bash
# Ver configuración
heroku config

# Ejecutar comando en la app
heroku run bash

# Ver logs
heroku logs --tail

# Reiniciar la app
heroku restart

# Escalar dynos
heroku ps:scale web=1

# Ver métricas
heroku ps
```

## 🆘 Troubleshooting

### Problemas Comunes

1. **Error de build**
   ```bash
   heroku logs --tail
   ```

2. **Error de base de datos**
   ```bash
   heroku pg:info
   heroku pg:reset
   ```

3. **Error de variables de entorno**
   ```bash
   heroku config
   ```

## ✅ Verificación Final

Después del despliegue, verificar:

1. **Frontend**: https://suaza-agropecuaria.herokuapp.com
2. **Backend API**: https://suaza-agropecuaria.herokuapp.com/api/health
3. **Base de datos**: Conectar con Prisma Studio
4. **Logs**: Revisar en Heroku Dashboard

## 🎯 Ventajas de Heroku

- ✅ **Fácil de usar**
- ✅ **Escalabilidad automática**
- ✅ **Integración con GitHub**
- ✅ **Backups automáticos**
- ✅ **SSL automático**
- ✅ **CDN incluido**
- ✅ **Monitoreo integrado**

¡Con Heroku tendrás el Sistema Suaza funcionando en la nube en menos de 1 hora! 🚀 
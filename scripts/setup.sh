#!/bin/bash

# Script de instalación y configuración para Suaza
# Sistema Integral de Gestión para Agropecuarias

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_message() {
    echo -e "${GREEN}[SUAZA]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[ADVERTENCIA]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar si estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -f "README.md" ]; then
    print_error "Este script debe ejecutarse desde el directorio raíz del proyecto Suaza"
    exit 1
fi

print_message "🚀 Iniciando instalación del Sistema Suaza..."

# Verificar requisitos del sistema
print_info "Verificando requisitos del sistema..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instale Node.js 18 o superior."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js versión 18 o superior es requerida. Versión actual: $(node -v)"
    exit 1
fi

print_message "✅ Node.js $(node -v) detectado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    print_error "npm no está instalado."
    exit 1
fi

print_message "✅ npm $(npm -v) detectado"

# Verificar Docker (opcional)
if command -v docker &> /dev/null; then
    print_message "✅ Docker detectado"
    DOCKER_AVAILABLE=true
else
    print_warning "Docker no está instalado. La instalación con Docker no estará disponible."
    DOCKER_AVAILABLE=false
fi

# Verificar Docker Compose
if command -v docker-compose &> /dev/null; then
    print_message "✅ Docker Compose detectado"
    DOCKER_COMPOSE_AVAILABLE=true
else
    print_warning "Docker Compose no está instalado."
    DOCKER_COMPOSE_AVAILABLE=false
fi

# Crear archivo .env si no existe
if [ ! -f "backend/.env" ]; then
    print_info "Creando archivo de configuración backend/.env..."
    cp backend/env.example backend/.env
    print_warning "Por favor configure las variables de entorno en backend/.env"
fi

# Instalar dependencias
print_info "Instalando dependencias..."

# Instalar dependencias del proyecto principal
print_message "Instalando dependencias del proyecto principal..."
npm install

# Instalar dependencias del backend
print_message "Instalando dependencias del backend..."
cd backend
npm install
cd ..

# Instalar dependencias del frontend
print_message "Instalando dependencias del frontend..."
cd frontend
npm install
cd ..

# Crear directorios necesarios
print_info "Creando directorios necesarios..."
mkdir -p backend/logs
mkdir -p backend/uploads
mkdir -p backend/backups
mkdir -p database/init
mkdir -p scripts
mkdir -p docs

# Configurar base de datos
print_info "Configurando base de datos..."

# Verificar si PostgreSQL está disponible
if command -v psql &> /dev/null; then
    print_message "PostgreSQL detectado localmente"
    print_info "Para configurar la base de datos manualmente, ejecute:"
    print_info "  cd backend && npm run db:migrate"
else
    print_warning "PostgreSQL no está instalado localmente."
    if [ "$DOCKER_AVAILABLE" = true ] && [ "$DOCKER_COMPOSE_AVAILABLE" = true ]; then
        print_info "Puede usar Docker para ejecutar PostgreSQL:"
        print_info "  docker-compose up postgres -d"
    fi
fi

# Crear script de inicio rápido
cat > start.sh << 'EOF'
#!/bin/bash
# Script de inicio rápido para Suaza

echo "🚀 Iniciando Sistema Suaza..."

# Verificar si Docker está disponible
if command -v docker-compose &> /dev/null; then
    echo "Iniciando con Docker Compose..."
    docker-compose up -d
    echo "✅ Sistema iniciado con Docker"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔧 Backend: http://localhost:3001"
    echo "📊 Logs: http://localhost:8080"
else
    echo "Iniciando en modo desarrollo..."
    npm run dev
fi
EOF

chmod +x start.sh

# Crear script de parada
cat > stop.sh << 'EOF'
#!/bin/bash
# Script de parada para Suaza

echo "🛑 Deteniendo Sistema Suaza..."

if command -v docker-compose &> /dev/null; then
    docker-compose down
    echo "✅ Sistema detenido"
else
    echo "Deteniendo procesos de desarrollo..."
    pkill -f "npm run dev" || true
    pkill -f "node.*server.js" || true
    echo "✅ Procesos detenidos"
fi
EOF

chmod +x stop.sh

# Crear script de backup
cat > scripts/backup.sh << 'EOF'
#!/bin/bash
# Script de backup automático

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="suaza_backup_$DATE.sql"

echo "🔄 Iniciando backup: $BACKUP_FILE"

# Backup de la base de datos
pg_dump -h postgres -U suaza_user -d suaza_db > "$BACKUP_DIR/$BACKUP_FILE"

# Comprimir backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Eliminar backups antiguos (más de 30 días)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "✅ Backup completado: $BACKUP_FILE.gz"
EOF

chmod +x scripts/backup.sh

# Crear documentación básica
cat > docs/INSTALACION.md << 'EOF'
# Guía de Instalación - Sistema Suaza

## Instalación Rápida

### Con Docker (Recomendado)
```bash
# Clonar el repositorio
git clone <repository-url>
cd suaza

# Configurar variables de entorno
cp backend/env.example backend/.env
# Editar backend/.env con tus configuraciones

# Iniciar con Docker
./start.sh
```

### Instalación Manual
```bash
# Instalar dependencias
npm run install:all

# Configurar base de datos
cd backend
npm run db:migrate
npm run db:seed

# Iniciar en modo desarrollo
npm run dev
```

## Configuración

### Variables de Entorno
Edita el archivo `backend/.env` con tus configuraciones:

- `DATABASE_URL`: URL de conexión a PostgreSQL
- `JWT_SECRET`: Clave secreta para JWT
- `DIAN_API_KEY`: Clave de API de la DIAN
- `SMTP_*`: Configuración de email

### Base de Datos
El sistema requiere PostgreSQL 14 o superior.

### Permisos
Asegúrate de que los directorios tengan permisos correctos:
```bash
chmod -R 755 backend/logs
chmod -R 755 backend/uploads
```

## Acceso al Sistema

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Documentación API**: http://localhost:3001/api-docs
- **Monitor de logs**: http://localhost:8080

## Usuario por Defecto

El primer usuario administrador debe crearse manualmente o a través del script de seed.

## Soporte

Para soporte técnico:
- Email: soporte@suaza.com
- WhatsApp: +57 300 123 4567
EOF

print_message "✅ Instalación completada exitosamente!"

print_info "📋 Próximos pasos:"
print_info "1. Configurar variables de entorno en backend/.env"
print_info "2. Configurar la base de datos PostgreSQL"
print_info "3. Ejecutar migraciones: cd backend && npm run db:migrate"
print_info "4. Iniciar el sistema: ./start.sh"

print_info "📚 Documentación disponible en docs/INSTALACION.md"

if [ "$DOCKER_AVAILABLE" = true ] && [ "$DOCKER_COMPOSE_AVAILABLE" = true ]; then
    print_info "🐳 Para usar Docker: docker-compose up -d"
fi

print_message "🎉 ¡Sistema Suaza listo para usar!" 
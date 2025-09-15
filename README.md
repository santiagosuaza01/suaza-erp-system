# Suaza - Sistema Integral de Gestión para Agropecuarias

## Descripción
Suaza es un sistema integral de gestión diseñado específicamente para agropecuarias que automatiza y optimiza la gestión de inventarios, ventas, compras, créditos, facturación electrónica y relación con proveedores.

## Características Principales
- 🏪 **Gestión de Inventario**: Control completo de stock con alertas automáticas
- 💰 **Ventas y Facturación**: Facturación electrónica integrada con DIAN
- 📊 **Compras y Proveedores**: Gestión de proveedores y cuentas por pagar
- 💳 **Créditos y Deudores**: Control de cuentas por cobrar y morosidad
- 📈 **Reportes y Dashboard**: Métricas en tiempo real y proyecciones
- 🔒 **Seguridad**: Roles, permisos y auditoría completa
- 🤖 **IA Integrada**: Predicciones y recomendaciones inteligentes

## Arquitectura del Sistema

### Backend
- **Framework**: Node.js con Express.js
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Autenticación**: JWT + 2FA
- **API**: RESTful con documentación Swagger

### Frontend
- **Framework**: React con TypeScript
- **UI**: Material-UI con tema personalizado
- **Estado**: Redux Toolkit
- **Responsive**: Diseño adaptativo para móviles

### Integraciones
- **DIAN**: Facturación electrónica
- **WhatsApp API**: Notificaciones automáticas
- **Pasarelas de Pago**: PSE, Nequi, Daviplata
- **Cloud**: AWS/GCP para backups y escalabilidad

## Estructura del Proyecto
```
suaza/
├── backend/                 # API REST con Node.js
├── frontend/               # Aplicación React
├── database/               # Migraciones y seeds
├── docs/                   # Documentación
├── scripts/                # Scripts de despliegue
└── docker/                 # Configuración Docker
```

## Instalación y Configuración

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- Docker (opcional)

### Instalación Rápida
```bash
# Clonar el repositorio
git clone <repository-url>
cd suaza

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Ejecutar migraciones
npm run db:migrate

# Iniciar desarrollo
npm run dev
```

## Módulos del Sistema

### 1. Gestión de Inventario
- Registro de productos con códigos de barras
- Control de stock mínimo/máximo
- Alertas automáticas de desabastecimiento
- Historial de movimientos

### 2. Ventas y Facturación
- Facturación electrónica DIAN
- Ventas al contado y crédito
- Notas crédito/débito
- Envío automático de facturas

### 3. Compras y Proveedores
- Registro de facturas de proveedores
- Importación automática XML
- OCR para facturas físicas
- Control de cuentas por pagar

### 4. Créditos y Deudores
- Gestión de créditos por cliente
- Alertas de vencimiento
- Bloqueo automático de deudores
- Reportes de morosidad

### 5. Reportes y Dashboard
- Métricas en tiempo real
- Productos más vendidos
- Análisis de rentabilidad
- Exportación a PDF/Excel

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| **Administrador** | Control total, usuarios, configuración |
| **Cajero** | Ventas, facturación, inventario básico |
| **Bodeguero** | Gestión completa de inventario |
| **Contador** | Reportes financieros y contables |
| **Proveedor** | Consulta de facturas y pagos |
| **Cliente** | Estado de cuenta y compras |

## Seguridad
- Cifrado AES-256 para datos sensibles
- Autenticación en dos pasos (2FA)
- Roles y permisos granulares
- Auditoría completa de operaciones
- Bloqueo por intentos fallidos

## Cumplimiento Legal
- Ley 1581 de 2012 (protección de datos)
- Ley 527 de 1999 (firma digital)
- Resolución DIAN 000042 de 2020
- Autenticación de proveedores autorizados

## Roadmap de IA
- ✅ Predicción de demanda
- ✅ Recomendaciones de pedidos
- ✅ Análisis de riesgo crediticio
- ✅ Chatbot inteligente
- ✅ Reconocimiento de facturas con visión por computadora

## Soporte
- 📧 Email: soporte@suaza.com
- 📱 WhatsApp: +57 300 123 4567
- 📖 Documentación: docs.suaza.com

## Licencia
© 2024 Suaza. Todos los derechos reservados. 
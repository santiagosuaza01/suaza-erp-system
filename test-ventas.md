# 🧪 Test Manual para Ventas - Suaza ERP

## 📋 **Pasos para probar el sistema de ventas**

### **1. Preparación del entorno**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm start
```

### **2. Verificar datos base**
- ✅ **Login:** admin@suaza.com / admin123
- ✅ **Clientes:** Debe haber al menos 1 cliente
- ✅ **Productos:** Debe haber al menos 3 productos con stock
- ✅ **Categorías:** Debe haber categorías

### **3. Test de creación de venta**

#### **Paso 1: Ir a Ventas**
- Navegar a http://localhost:3000/sales
- Verificar que la página carga sin errores

#### **Paso 2: Crear nueva venta**
- Click en "Nueva Venta"
- **Seleccionar cliente:** Elegir cualquier cliente de la lista
- **Agregar productos:**
  - Producto 1: Cantidad 2
  - Producto 2: Cantidad 1  
  - Producto 3: Cantidad 3
- **Método de pago:** Efectivo
- **Descuento:** 0

#### **Paso 3: Verificar cálculos**
- **Subtotal:** Suma de (precio × cantidad) de todos los productos
- **IVA (19%):** Subtotal × 0.19
- **Total:** Subtotal + IVA - Descuento

#### **Paso 4: Guardar venta**
- Click en "Guardar"
- Verificar que aparece mensaje de éxito
- Verificar que la venta aparece en la tabla

### **4. Test de visualización de ventas**

#### **Verificar tabla de ventas:**
- ✅ **Número de factura:** INV-XXXXXXXX-XXX
- ✅ **Cliente:** Nombre del cliente seleccionado
- ✅ **Fecha:** Fecha actual
- ✅ **Total:** Monto calculado correctamente
- ✅ **Estado:** completed (para efectivo) o pending (para crédito)

#### **Verificar estadísticas:**
- ✅ **Total de ventas:** Número correcto
- ✅ **Ventas completadas:** Número correcto
- ✅ **Ventas pendientes:** Número correcto

### **5. Test de diferentes escenarios**

#### **Escenario 1: Venta en efectivo**
- Cliente: Cualquiera
- Productos: Varios
- Método: Efectivo
- Estado esperado: completed

#### **Escenario 2: Venta a crédito**
- Cliente: Cualquiera
- Productos: Varios
- Método: Crédito
- Estado esperado: pending

#### **Escenario 3: Venta con descuento**
- Cliente: Cualquiera
- Productos: Varios
- Descuento: 10%
- Verificar cálculos correctos

### **6. Verificar en Reportes**
- Ir a Reportes
- Verificar que "Ventas Recientes" muestra las ventas creadas
- Verificar que los datos coinciden con la página de Ventas

## 🐛 **Posibles errores y soluciones**

### **Error 400 en creación:**
- Verificar que customerId no esté vacío
- Verificar que items no esté vacío
- Verificar tipos de datos (quantity: int, unitPrice: float)

### **Error en visualización:**
- Verificar que response.data.sales existe
- Verificar que los status coinciden (completed/pending)

### **Error en cálculos:**
- Verificar que los precios son números, no strings
- Verificar que no hay concatenación de strings

## 📊 **Datos esperados**

### **Estructura de venta:**
```json
{
  "id": "uuid",
  "invoiceNumber": "INV-1234567890-123",
  "customerId": "uuid",
  "subtotal": 52000,
  "tax": 9880,
  "total": 61880,
  "paymentMethod": "cash",
  "status": "completed",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 25000
    }
  ]
}
```

### **Respuesta del backend:**
```json
{
  "sales": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

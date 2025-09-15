// 🧪 Test de API de Ventas - Suaza ERP
// Ejecutar con: node test-sales-api.js

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Función para hacer login y obtener token
async function login() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin@suaza.com',
      password: 'admin123'
    });
    return response.data.accessToken;
  } catch (error) {
    console.error('Error en login:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener clientes
async function getCustomers(token) {
  try {
    const response = await axios.get(`${API_BASE}/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.customers || response.data;
  } catch (error) {
    console.error('Error obteniendo clientes:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener productos
async function getProducts(token) {
  try {
    const response = await axios.get(`${API_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.products || response.data;
  } catch (error) {
    console.error('Error obteniendo productos:', error.response?.data || error.message);
    throw error;
  }
}

// Función para crear una venta
async function createSale(token, saleData) {
  try {
    const response = await axios.post(`${API_BASE}/sales`, saleData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error creando venta:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener ventas
async function getSales(token) {
  try {
    const response = await axios.get(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error obteniendo ventas:', error.response?.data || error.message);
    throw error;
  }
}

// Test principal
async function runTest() {
  console.log('🚀 Iniciando test de API de Ventas...\n');

  try {
    // 1. Login
    console.log('1️⃣ Haciendo login...');
    const token = await login();
    console.log('✅ Login exitoso\n');

    // 2. Obtener clientes
    console.log('2️⃣ Obteniendo clientes...');
    const customers = await getCustomers(token);
    console.log(`✅ Encontrados ${customers.length} clientes`);
    console.log('Primer cliente:', customers[0]?.name || 'No hay clientes\n');

    // 3. Obtener productos
    console.log('3️⃣ Obteniendo productos...');
    const products = await getProducts(token);
    console.log(`✅ Encontrados ${products.length} productos`);
    console.log('Primeros 3 productos:');
    products.slice(0, 3).forEach(p => {
      console.log(`  - ${p.name}: $${p.price} (Stock: ${p.stock})`);
    });
    console.log('');

    // 4. Crear venta de prueba
    if (customers.length > 0 && products.length >= 2) {
      console.log('4️⃣ Creando venta de prueba...');
      const saleData = {
        customerId: customers[0].id,
        paymentMethod: 'cash',
        items: [
          {
            productId: products[0].id,
            quantity: 2,
            unitPrice: products[0].price
          },
          {
            productId: products[1].id,
            quantity: 1,
            unitPrice: products[1].price
          }
        ]
      };
      
      console.log('Datos de venta:', JSON.stringify(saleData, null, 2));
      const newSale = await createSale(token, saleData);
      console.log('✅ Venta creada exitosamente');
      console.log('ID de venta:', newSale.id);
      console.log('Número de factura:', newSale.invoiceNumber);
      console.log('Total:', newSale.total);
      console.log('');
    } else {
      console.log('❌ No hay suficientes datos para crear venta\n');
    }

    // 5. Obtener ventas
    console.log('5️⃣ Obteniendo ventas...');
    const salesResponse = await getSales(token);
    console.log('✅ Ventas obtenidas');
    console.log('Estructura de respuesta:', Object.keys(salesResponse));
    console.log(`Total de ventas: ${salesResponse.sales?.length || 0}`);
    
    if (salesResponse.sales && salesResponse.sales.length > 0) {
      console.log('Primera venta:');
      const firstSale = salesResponse.sales[0];
      console.log(`  - ID: ${firstSale.id}`);
      console.log(`  - Factura: ${firstSale.invoiceNumber}`);
      console.log(`  - Cliente: ${firstSale.customer?.name || 'Sin cliente'}`);
      console.log(`  - Total: $${firstSale.total}`);
      console.log(`  - Estado: ${firstSale.status}`);
      console.log(`  - Método: ${firstSale.paymentMethod}`);
      console.log(`  - Items: ${firstSale.items?.length || 0}`);
    }
    console.log('');

    console.log('🎉 Test completado exitosamente!');

  } catch (error) {
    console.error('❌ Test falló:', error.message);
    process.exit(1);
  }
}

// Ejecutar test
runTest();

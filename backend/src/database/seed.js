const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // 1. Crear roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrador del sistema',
      permissions: ['*'] // Todos los permisos
    }
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Usuario estándar',
      permissions: [
        'customers:read',
        'customers:create',
        'customers:update',
        'products:read',
        'sales:read',
        'sales:create'
      ]
    }
  });

  console.log('✅ Roles creados');

  // 2. Crear usuario administrador
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@suaza.com' },
    update: {},
    create: {
      email: 'admin@suaza.com',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Administrador',
      lastName: 'Suaza',
      isActive: true,
      isEmailVerified: true,
      roleId: adminRole.id
    }
  });

  console.log('✅ Usuario administrador creado');

  // 3. Crear categorías de productos
  const categories = [
    { name: 'Fertilizantes', description: 'Abonos y fertilizantes para cultivos' },
    { name: 'Semillas', description: 'Semillas de diferentes cultivos' },
    { name: 'Herramientas', description: 'Herramientas agrícolas' },
    { name: 'Pesticidas', description: 'Productos para control de plagas' },
    { name: 'Riego', description: 'Sistemas y equipos de riego' }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category
    });
  }

  console.log('✅ Categorías creadas');

  // 4. Crear clientes de prueba
  const customers = [
    {
      name: 'Juan Pérez',
      taxId: '12345678-9',
      email: 'juan.perez@email.com',
      phone: '3001234567',
      address: 'Calle 123 #45-67',
      city: 'Bogotá',
      creditLimit: 5000000
    },
    {
      name: 'María García',
      taxId: '87654321-0',
      email: 'maria.garcia@email.com',
      phone: '3007654321',
      address: 'Carrera 45 #78-90',
      city: 'Medellín',
      creditLimit: 3000000
    },
    {
      name: 'Carlos López',
      taxId: '11223344-5',
      email: 'carlos.lopez@email.com',
      phone: '3009876543',
      address: 'Avenida 80 #12-34',
      city: 'Cali',
      creditLimit: 2000000
    },
    {
      name: 'Ana Rodríguez',
      taxId: '55667788-9',
      email: 'ana.rodriguez@email.com',
      phone: '3004567890',
      address: 'Calle 50 #23-45',
      city: 'Barranquilla',
      creditLimit: 4000000
    },
    {
      name: 'Pedro Martínez',
      taxId: '99887766-5',
      email: 'pedro.martinez@email.com',
      phone: '3002345678',
      address: 'Carrera 30 #56-78',
      city: 'Cartagena',
      creditLimit: 1500000
    }
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { taxId: customer.taxId },
      update: {},
      create: customer
    });
  }

  console.log('✅ Clientes de prueba creados');

  // 5. Crear productos de prueba
  const fertilizantesCategory = await prisma.category.findUnique({
    where: { name: 'Fertilizantes' }
  });

  const semillasCategory = await prisma.category.findUnique({
    where: { name: 'Semillas' }
  });

  const products = [
    {
      code: 'FERT-001',
      barcode: '1234567890123',
      name: 'Fertilizante NPK 15-15-15',
      description: 'Fertilizante completo para cultivos',
      categoryId: fertilizantesCategory.id,
      unit: 'kg',
      price: 25000,
      cost: 18000,
      stock: 100,
      minStock: 10
    },
    {
      code: 'SEM-001',
      barcode: '1234567890124',
      name: 'Semillas de Tomate',
      description: 'Semillas de tomate híbrido',
      categoryId: semillasCategory.id,
      unit: 'paquete',
      price: 15000,
      cost: 10000,
      stock: 50,
      minStock: 5
    },
    {
      code: 'FERT-002',
      barcode: '1234567890125',
      name: 'Abono Orgánico',
      description: 'Abono orgánico para huertas',
      categoryId: fertilizantesCategory.id,
      unit: 'kg',
      price: 12000,
      cost: 8000,
      stock: 75,
      minStock: 8
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product
    });
  }

  console.log('✅ Productos de prueba creados');

  console.log('🎉 Seed completado exitosamente!');
  console.log('\n📋 Datos creados:');
  console.log('- Usuario admin: admin@suaza.com / admin123');
  console.log('- 5 clientes de prueba');
  console.log('- 5 categorías de productos');
  console.log('- 3 productos de prueba');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { customersService, productsService, salesService } from '../services/api';

interface DashboardStats {
  totalCustomers: number;
  totalProducts: number;
  totalSales: number;
  lowStockProducts: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalProducts: 0,
    totalSales: 0,
    lowStockProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const [customersRes, productsRes, salesRes] = await Promise.all([
        customersService.getAll(),
        productsService.getAll(),
        salesService.getAll(),
      ]);

      const customers = customersRes.data.customers || customersRes.data;
      const products = productsRes.data.products || productsRes.data;
      const sales = salesRes.data.sales || salesRes.data;

      setStats({
        totalCustomers: customers.length,
        totalProducts: products.length,
        totalSales: sales.length,
        lowStockProducts: products.filter((p: any) => p.stock <= p.minStock).length,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Gestión de Clientes',
      description: 'Administrar clientes, créditos y deudores',
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      path: '/customers',
    },
    {
      title: 'Gestión de Productos',
      description: 'Control de productos e inventario',
      icon: <InventoryIcon sx={{ fontSize: 40 }} />,
      color: '#388e3c',
      path: '/products',
    },
    {
      title: 'Gestión de Ventas',
      description: 'Facturación y gestión de ventas',
      icon: <ShoppingCartIcon sx={{ fontSize: 40 }} />,
      color: '#f57c00',
      path: '/sales',
    },
    {
      title: 'Reportes y Análisis',
      description: 'Métricas y análisis del negocio',
      icon: <AssessmentIcon sx={{ fontSize: 40 }} />,
      color: '#7b1fa2',
      path: '/reports',
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        🏠 Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
        Bienvenido al Sistema de Gestión Agropecuaria Suaza
      </Typography>

      <Grid container spacing={3}>
        {quickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box
                  sx={{
                    color: action.color,
                    mb: 2,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  {action.icon}
                </Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {action.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {action.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => navigate(action.path)}
                  sx={{ bgcolor: action.color }}
                >
                  Acceder
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          📊 Resumen del Sistema
        </Typography>
        <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" color="primary">
              {stats.totalCustomers}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Clientes Registrados
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" color="success.main">
              {stats.totalProducts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Productos en Stock
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            <Typography variant="h4" color="warning.main">
              {stats.totalSales}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ventas Registradas
            </Typography>
          </Box>
        </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Dashboard;

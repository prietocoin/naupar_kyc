const express = require('express');
const cors = require('cors');
require('dotenv').config();

const kycRoutes = require('./routes/kycRoutes');
const adminRoutes = require('./routes/adminRoutes'); // <--- AGREGAR ESTA LÍNEA

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API
app.use('/api', kycRoutes);
app.use('/api/admin', adminRoutes); // <--- AGREGAR ESTA LÍNEA

// Servir frontend estático (index.html)
app.use(express.static('.'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'KYC Backend Operativo' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor KYC corriendo en el puerto ${PORT}`);
});

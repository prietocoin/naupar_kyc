const express = require('express');
const cors = require('cors');
require('dotenv').config();

const kycRoutes = require('./routes/kycRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API
app.use('/api', kycRoutes);

// Endpoint para verificar que el servidor esté vivo en EasyPanel
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'KYC Backend Operativo' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor KYC corriendo en el puerto ${PORT}`);
});

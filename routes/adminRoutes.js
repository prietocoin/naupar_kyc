const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rutas de administración
router.post('/login', adminController.login);
router.get('/solicitudes', adminController.obtenerSolicitudes);
router.patch('/solicitudes/:id', adminController.cambiarEstado);
router.delete('/solicitudes/:id', adminController.eliminarSolicitud);

// Ruta proxy autenticada para servir multimedia de R2
router.get('/media/*', adminController.obtenerMedia);

module.exports = router;

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Rutas de administración puras
router.post('/login', adminController.login);
router.get('/solicitudes', adminController.obtenerSolicitudes);
router.patch('/solicitudes/:id', adminController.cambiarEstado);
router.delete('/solicitudes/:id', adminController.eliminarSolicitud);

module.exports = router;

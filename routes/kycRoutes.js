const express = require('express');
const router = express.Router();
const multer = require('multer');
const kycController = require('../controllers/kycController');

// Multer guarda las fotos en memoria temporal para enviarlas a R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB por archivo
});

const uploadFields = upload.fields([
  { name: 'doc_frente', maxCount: 1 },
  { name: 'doc_dorso', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'domicilio', maxCount: 1 },
  { name: 'firma', maxCount: 1 },
  { name: 'doc_empresa', maxCount: 1 }
]);

router.post('/kyc', uploadFields, kycController.registrarKYC);

module.exports = router;

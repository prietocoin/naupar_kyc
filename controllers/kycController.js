const db = require('../config/db');
const { uploadToR2 } = require('../config/r2');
const { notificarNuevoKYC } = require('./adminController');

exports.registrarKYC = async (req, res) => {
  try {
    // 1. Extraer datos en texto enviados desde la PWA
    const body = req.body;
    const files = req.files; // Recibidos mediante Multer en memoria

    if (!files || !files.doc_frente || !files.doc_dorso || !files.selfie || !files.domicilio || !files.firma) {
      return res.status(400).json({ success: false, error: 'Faltan documentos obligatorios o la firma.' });
    }

    // 2. Subir archivos a Cloudflare R2 en paralelo
    const timestamp = Date.now();
    const folder = `kyc/${body.numero_documento}_${timestamp}`;

    const [frenteR2, dorsoR2, selfieR2, domicilioR2, firmaR2, empresaDocR2] = await Promise.all([
      uploadToR2(files.doc_frente[0].buffer, `${folder}/doc_frente.jpg`, files.doc_frente[0].mimetype),
      uploadToR2(files.doc_dorso[0].buffer, `${folder}/doc_dorso.jpg`, files.doc_dorso[0].mimetype),
      uploadToR2(files.selfie[0].buffer, `${folder}/selfie.jpg`, files.selfie[0].mimetype),
      uploadToR2(files.domicilio[0].buffer, `${folder}/domicilio.jpg`, files.domicilio[0].mimetype),
      uploadToR2(files.firma[0].buffer, `${folder}/firma.png`, files.firma[0].mimetype),
      files.doc_empresa ? uploadToR2(files.doc_empresa[0].buffer, `${folder}/doc_empresa.pdf`, files.doc_empresa[0].mimetype) : Promise.resolve(null)
    ]);

    // 3. Insertar el registro en la base de datos PostgreSQL
    const query = `
      INSERT INTO solicitudes_kyc (
        nombres, apellidos, tipo_documento, numero_documento, nacionalidad, fecha_nacimiento,
        pais_residencia, ciudad_residencia, direccion_actual, whatsapp_principal, whatsapp_secundario, email, redes_sociales,
        r2_doc_frente_key, r2_doc_dorso_key, r2_doc_selfie_key, r2_doc_domicilio_key,
        tiempo_experiencia, nombre_comercial, paises_opera, monedas_opera, medios_trabajo,
        tipo_operacion, volumen_diario, monto_aproximado, moneda_base, capital_trabajo,
        empresa_razon_social, empresa_registro_fiscal, empresa_pais_constitucion, empresa_actividad, empresa_representante, r2_doc_empresa_key,
        referencias, antecedentes, aceptacion_terminos, r2_firma_key
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37
      ) RETURNING id;
    `;

    const values = [
      body.nombres, body.apellidos, body.tipo_documento, body.numero_documento, body.nacionalidad, body.fecha_nacimiento,
      body.pais_residencia, body.ciudad_residencia, body.direccion_actual, body.whatsapp_principal, body.whatsapp_secundario || null, body.email, body.redes_sociales || null,
      frenteR2.key, dorsoR2.key, selfieR2.key, domicilioR2.key,
      body.tiempo_experiencia, body.nombre_comercial || null, body.paises_opera, body.monedas_opera, body.medios_trabajo,
      body.tipo_operacion, body.volumen_diario || null, body.monto_aproximado || null, body.moneda_base || null, body.capital_trabajo,
      body.empresa_razon_social || null, body.empresa_registro_fiscal || null, body.empresa_pais_constitucion || null, body.empresa_actividad || null, body.empresa_representante || null, empresaDocR2 ? empresaDocR2.key : null,
      body.referencias, body.antecedentes, true, firmaR2.key
    ];

    const result = await db.query(query, values);

    // 4. Disparar notificación Web Push al panel administrador en segundo plano
    notificarNuevoKYC({
      nombres: body.nombres,
      apellidos: body.apellidos,
      numero_documento: body.numero_documento
    }).catch(err => console.error('Error enviando push:', err));

    res.status(201).json({
      success: true,
      message: 'Solicitud KYC registrada exitosamente',
      solicitud_id: result.rows[0].id
    });

  } catch (error) {
    console.error('Error al procesar el KYC:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor al procesar el KYC' });
  }
};

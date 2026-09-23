const db = require('../config/db');
const { deleteFromR2 } = require('../config/r2');

// 1. Autenticación simple del Superusuario
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT id, email, password_hash FROM usuarios_admin WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const admin = result.rows[0];

    // Verificación de contraseña (ajusta según tu hash o comparación)
    if (admin.password_hash !== password) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      admin: { id: admin.id, email: admin.email }
    });
  } catch (error) {
    console.error('Error en login admin:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
};

// 2. Obtener la lista completa de solicitudes KYC
exports.obtenerSolicitudes = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM solicitudes_kyc ORDER BY creado_en DESC'
    );

    res.json({
      success: true,
      total: result.rows.length,
      solicitudes: result.rows
    });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ success: false, error: 'Error al consultar la base de datos' });
  }
};

// 3. Cambiar estado de la solicitud (aprobar o rechazar)
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'aprobado' | 'rechazado' | 'pendiente'

    if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado no válido' });
    }

    const result = await db.query(
      'UPDATE solicitudes_kyc SET estado = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, estado',
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    res.json({
      success: true,
      message: `Solicitud #${id} actualizada a '${estado}'`,
      solicitud: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

// 4. Eliminar registro y limpiar archivos de Cloudflare R2
exports.eliminarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener las keys de R2 asociadas a este registro antes de borrarlo
    const result = await db.query(
      `SELECT r2_doc_frente_key, r2_doc_dorso_key, r2_doc_selfie_key, 
              r2_doc_domicilio_key, r2_doc_empresa_key, r2_firma_key, r2_pdf_expediente_key 
       FROM solicitudes_kyc WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    const row = result.rows[0];

    // Eliminar todos los archivos adjuntos en Cloudflare R2
    const keysAEliminar = [
      row.r2_doc_frente_key,
      row.r2_doc_dorso_key,
      row.r2_doc_selfie_key,
      row.r2_doc_domicilio_key,
      row.r2_doc_empresa_key,
      row.r2_firma_key,
      row.r2_pdf_expediente_key
    ].filter(Boolean); // Filtra valores null o undefined

    await Promise.all(keysAEliminar.map(key => deleteFromR2(key)));

    // Eliminar la fila en PostgreSQL
    await db.query('DELETE FROM solicitudes_kyc WHERE id = $1', [id]);

    res.json({
      success: true,
      message: `Solicitud #${id} y sus archivos en R2 eliminados correctamente`
    });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar el registro' });
  }
};

const db = require('../config/db');
const { deleteFromR2, getObjectFromR2 } = require('../config/r2');
const webpush = require('web-push');

// Configuración inicial de Web Push con llaves VAPID
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_MAIL || 'mailto:admin@jairokov.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (e) {
  console.error('Error al configurar WebPush:', e.message);
}

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
    const { estado } = req.body;

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

    const keysAEliminar = [
      row.r2_doc_frente_key,
      row.r2_doc_dorso_key,
      row.r2_doc_selfie_key,
      row.r2_doc_domicilio_key,
      row.r2_doc_empresa_key,
      row.r2_firma_key,
      row.r2_pdf_expediente_key
    ].filter(Boolean);

    await Promise.all(keysAEliminar.map(key => deleteFromR2(key)));

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

// 5. Servir archivos multimedia de R2 mediante proxy seguro
exports.obtenerMedia = async (req, res) => {
  try {
    let key = req.params[0];
    if (!key) return res.status(400).send('Key no especificada');

    key = key.replace(/^\/+/, '');

    const objectData = await getObjectFromR2(key);

    let contentType = objectData.ContentType;
    if (!contentType || contentType === 'application/octet-stream') {
      if (key.endsWith('.pdf')) contentType = 'application/pdf';
      else if (key.endsWith('.png')) contentType = 'image/png';
      else if (key.endsWith('.webp')) contentType = 'image/webp';
      else contentType = 'image/jpeg';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const byteArray = await objectData.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);

    return res.send(buffer);
  } catch (error) {
    console.error('Error al servir media desde R2:', error.message);
    return res.status(404).send('Archivo no encontrado');
  }
};

// 6. Registrar suscripción Push del navegador admin
exports.suscribirPush = async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Suscripción inválida' });
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT UNIQUE NOT NULL,
        keys JSONB NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(
      `INSERT INTO push_subscriptions (endpoint, keys) 
       VALUES ($1, $2) 
       ON CONFLICT (endpoint) DO UPDATE SET keys = $2`,
      [subscription.endpoint, JSON.stringify(subscription.keys)]
    );

    res.status(201).json({ success: true, message: 'Navegador suscrito a notificaciones push' });
  } catch (error) {
    console.error('Error al guardar suscripción push:', error);
    res.status(500).json({ error: 'Error interno en el servidor' });
  }
};

// 7. Disparar notificación push flotante a administradores
exports.notificarNuevoKYC = async (datosCliente) => {
  try {
    const result = await db.query('SELECT endpoint, keys FROM push_subscriptions');
    if (!result.rows || result.rows.length === 0) return;

    const payload = JSON.stringify({
      title: '🚨 NUEVO KYC REGISTRADO',
      body: `Cliente: ${datosCliente.nombres || ''} ${datosCliente.apellidos || ''} (${datosCliente.numero_documento || ''})`,
      url: '/admin.html'
    });

    const envios = result.rows.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
      };
      
      return webpush.sendNotification(pushSubscription, payload).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        }
      });
    });

    await Promise.all(envios);
  } catch (error) {
    console.error('Error enviando notificación push:', error);
  }
};

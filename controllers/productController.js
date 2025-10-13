import cloudinary from 'cloudinary';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';

dotenv.config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});


// 🟢 CREATE
export const createProduct = async (req, res) => {
  try {
    console.log(req.files);
    const { name } = req.body;

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    if (!imageFile) {
      return res.status(400).json({ error: "La imagen es obligatoria" });
    }

    const image = await cloudinary.v2.uploader.upload(imageFile.path, {
      folder: "gallery/thumbs",
      resource_type: "image",
    });

    let video = null;
    if (videoFile) {
      video = await cloudinary.v2.uploader.upload(videoFile.path, {
        folder: "gallery/videos",
        resource_type: "video",
      });
    }

    await connection.query(
      `INSERT INTO products (name, image_url, image_public_id, video_url, video_public_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        image.secure_url,
        image.public_id,
        video?.secure_url || null,
        video?.public_id || null,
      ]
    );

    fs.unlinkSync(imageFile.path);
    if (videoFile) fs.unlinkSync(videoFile.path);

    res.status(201).json({ message: "Producto creado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear el producto" });
  }
};

// 🔵 READ ALL
export const getProducts = async (req, res) => {
  try {
    const [rows] = await connection.query('SELECT * FROM products ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};


// 🟣 READ ONE
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};


// 🟠 UPDATE
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Obtener producto actual
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const product = rows[0];

    let image_url = product.image_url;
    let video_url = product.video_url;
    let image_public_id = product.image_public_id;
    let video_public_id = product.video_public_id;

    // Si hay nueva imagen, reemplazar en Cloudinary
    if (req.files?.image) {
      await cloudinary.v2.uploader.destroy(image_public_id);
      const image = await cloudinary.v2.uploader.upload(req.files.image.path, {
        folder: 'gallery/images'
      });
      image_url = image.secure_url;
      image_public_id = image.public_id;
      fs.unlinkSync(req.files.image.path);
    }

    // Si hay nuevo video
    if (req.files?.video) {
      await cloudinary.v2.uploader.destroy(video_public_id, { resource_type: 'video' });
      const video = await cloudinary.v2.uploader.upload(req.files.video.path, {
        folder: 'gallery/videos',
        resource_type: 'video'
      });
      video_url = video.secure_url;
      video_public_id = video.public_id;
      fs.unlinkSync(req.files.video.path);
    }

    // Actualizar registro
    await connection.query(
      `UPDATE products
       SET name = ?, image_url = ?, image_public_id = ?, video_url = ?, video_public_id = ?
       WHERE id = ?`,
      [name, image_url, image_public_id, video_url, video_public_id, id]
    );

    res.json({ message: 'Producto actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};


// 🔴 DELETE
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener producto
    const [rows] = await connection.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    const product = rows[0];

    // Borrar archivos de Cloudinary
    if (product.image_public_id)
      await cloudinary.v2.uploader.destroy(product.image_public_id);
    if (product.video_public_id)
      await cloudinary.v2.uploader.destroy(product.video_public_id, { resource_type: 'video' });

    // Eliminar registro de la BD
    await connection.query('DELETE FROM products WHERE id = ?', [id]);

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

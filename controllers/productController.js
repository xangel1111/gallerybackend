import cloudinary from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import pkg from 'pg';
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/*
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});
*/

export const createProduct = async (req, res) => {
  try {
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

    await pool.query(
      `INSERT INTO gallery 
       (name, image_url, image_public_id, video_url, video_public_id)
       VALUES ($1, $2, $3, $4, $5)`,
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

export const getProducts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM gallery ORDER BY id DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      'SELECT * FROM gallery WHERE id = $1',
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const { rows } = await pool.query(
      'SELECT * FROM gallery WHERE id = $1',
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });

    const product = rows[0];

    let image_url = product.image_url;
    let video_url = product.video_url;
    let image_public_id = product.image_public_id;
    let video_public_id = product.video_public_id;

    if (req.files?.image?.[0]) {
      await cloudinary.v2.uploader.destroy(image_public_id);

      const image = await cloudinary.v2.uploader.upload(
        req.files.image[0].path,
        { folder: 'gallery/images' }
      );

      image_url = image.secure_url;
      image_public_id = image.public_id;

      fs.unlinkSync(req.files.image[0].path);
    }

    if (req.files?.video?.[0]) {
      await cloudinary.v2.uploader.destroy(video_public_id, {
        resource_type: 'video'
      });

      const video = await cloudinary.v2.uploader.upload(
        req.files.video[0].path,
        {
          folder: 'gallery/videos',
          resource_type: 'video'
        }
      );

      video_url = video.secure_url;
      video_public_id = video.public_id;

      fs.unlinkSync(req.files.video[0].path);
    }

    await pool.query(
      `UPDATE products
       SET name = $1,
           image_url = $2,
           image_public_id = $3,
           video_url = $4,
           video_public_id = $5
       WHERE id = $6`,
      [name, image_url, image_public_id, video_url, video_public_id, id]
    );

    res.json({ message: 'Producto actualizado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      'SELECT * FROM gallery WHERE id = $1',
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: 'Producto no encontrado' });

    const product = rows[0];

    if (product.image_public_id)
      await cloudinary.v2.uploader.destroy(product.image_public_id);

    if (product.video_public_id)
      await cloudinary.v2.uploader.destroy(
        product.video_public_id,
        { resource_type: 'video' }
      );

    await pool.query(
      'DELETE FROM gallery WHERE id = $1',
      [id]
    );

    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};
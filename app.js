import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import productRoutes from "./routes/productRoutes.js";

dotenv.config();

const app = express();

app.use(cors());

app.use("/api/products", productRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Servidor de galería activo ✅");
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
